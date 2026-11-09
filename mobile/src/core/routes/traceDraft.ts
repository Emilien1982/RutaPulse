// A trace (ordered circuit or imported GPX) cut into a draft with kept legs
// (ADR 0020, sections 3, 4 and 5). Pure logic: no engine call, no React.

import { createDraftState, type DraftState } from '@/core/draft/draft';
import { HAND_SPEED_KMH } from '@/core/draft/legs';
import { isInsideBbox } from '@/core/zones/activeZone';
import type { Bbox } from '@/core/zones/catalogue';

import { trackLengthM } from '@/core/gpx/trackLengthM';
import { legKey, type KeptLeg, type KeptLegs } from './reopen';
import type { LonLat } from './savedRoute';

export const MIN_LEGS = 1;
export const MAX_LEGS = 50;
/** Target length of a leg (m): the number of legs is round(length / this). */
const LEG_TARGET_M = 1000;

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
const same = (a: LonLat, b: LonLat) => a[0] === b[0] && a[1] === b[1];

/** The points with no two equal points in a row. */
function dedupe(points: readonly LonLat[]): LonLat[] {
  const out: LonLat[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || !same(last, p)) out.push(p);
  }
  return out;
}

/** Number of legs for a trace of this length (m): equal parts, 1 to 50. */
export function legCount(lengthM: number): number {
  return Math.min(
    MAX_LEGS,
    Math.max(MIN_LEGS, Math.round(lengthM / LEG_TARGET_M)),
  );
}

export type CutTrace = {
  /** The waypoints, in order (6 decimals). At least the two ends. */
  points: LonLat[];
  /** legs[i] is the piece of the trace from points[i] to points[i + 1]. */
  legs: LonLat[][];
};

/**
 * Cuts the trace into n equal parts (ADR 0020, section 3). A waypoint inside
 * the trace that falls outside `bbox` is not posted: its two pieces make one.
 * The two ends are always posted.
 */
export function cutTrace(line: readonly LonLat[], bbox: Bbox): CutTrace {
  if (line.length < 2) return { points: [...line], legs: [] };
  const cumul = [0];
  for (let i = 1; i < line.length; i++) {
    cumul.push(cumul[i - 1] + trackLengthM([line[i - 1], line[i]]));
  }
  const total = cumul[cumul.length - 1];
  // A trace of 2 points is one leg, whatever its length (the straight line).
  const n = line.length === 2 ? 1 : legCount(total);
  const dist = (k: number) => (k === n ? total : (k * total) / n);

  // Waypoint k and the index of the first vertex after it.
  const cuts: { point: LonLat; next: number }[] = [];
  let seg = 1;
  for (let k = 0; k <= n; k++) {
    const d = dist(k);
    if (k === 0) {
      cuts.push({ point: line[0], next: 1 });
      continue;
    }
    if (k === n) {
      cuts.push({ point: line[line.length - 1], next: line.length });
      continue;
    }
    while (seg < line.length - 1 && cumul[seg] < d) seg++;
    const span = cumul[seg] - cumul[seg - 1];
    const t = span > 0 ? (d - cumul[seg - 1]) / span : 0;
    const a = line[seg - 1];
    const b = line[seg];
    cuts.push({
      point: [
        round6(a[0] + (b[0] - a[0]) * t),
        round6(a[1] + (b[1] - a[1]) * t),
      ],
      next: t >= 1 ? seg + 1 : seg,
    });
  }

  const posted = cuts
    .map((_, k) => k)
    .filter(
      (k) =>
        k === 0 || k === n || isInsideBbox(bbox, ...(cuts[k].point as LonLat)),
    );
  const points = posted.map((k) => cuts[k].point);
  const legs = posted.slice(1).map((k, i) => {
    const from = cuts[posted[i]];
    // Vertices strictly between the two cuts (the cut point may be a vertex).
    const inner = line.slice(from.next, cuts[k].next);
    return dedupe([from.point, ...inner, cuts[k].point]);
  });
  return { points, legs };
}

export type Nearest = {
  /** The nearest point of the line (6 decimals). */
  point: LonLat;
  /** The point is on the segment from line[segment] to line[segment + 1]. */
  segment: number;
};

/**
 * The point of the line nearest to the position, by projection on each
 * segment in a local plane (longitudes times cos(latitude)). No distance
 * limit.
 */
export function nearestOnLine(
  line: readonly LonLat[],
  position: LonLat,
): Nearest {
  const cos = Math.cos((position[1] * Math.PI) / 180);
  const px = position[0] * cos;
  const py = position[1];
  let best: Nearest = { point: line[0], segment: 0 };
  let bestD = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = (b[0] - a[0]) * cos;
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const raw =
      len2 > 0 ? ((px - a[0] * cos) * dx + (py - a[1]) * dy) / len2 : 0;
    const t = Math.min(1, Math.max(0, raw));
    const point: LonLat =
      t <= 0
        ? a
        : t >= 1
          ? b
          : [
              round6(a[0] + (b[0] - a[0]) * t),
              round6(a[1] + (b[1] - a[1]) * t),
            ];
    const d = (point[0] * cos - px) ** 2 + (point[1] - py) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { point, segment: i };
    }
  }
  return best;
}

/**
 * Rotates a loop (first point = last point) to start at `start`. The new
 * line is start, the end of the line, then its beginning, back to start. The
 * junction point appears once, and a start that is a vertex is not repeated.
 */
export function rotateLoop(line: readonly LonLat[], start: Nearest): LonLat[] {
  const { point, segment } = start;
  return dedupe([
    point,
    ...line.slice(segment + 1),
    ...line.slice(1, segment + 1),
    point,
  ]);
}

export type TraceOptions = {
  loop: boolean;
  /** Last known position; a loop starts at the point nearest to it. */
  position?: LonLat | null;
  zoneVersion: number;
  /** Rectangle of the zone in service. */
  bbox: Bbox;
};

/** A kept leg for a piece of trace: not from the engine, 10 km/h. */
export function traceLeg(
  piece: readonly LonLat[],
  zoneVersion: number,
): KeptLeg {
  const distanceKm = trackLengthM(piece) / 1000;
  return {
    ok: true,
    shape: piece.map((p) => [p[0], p[1]]),
    distanceKm,
    // Not rounded: the legs add up to the duration of the whole trace.
    durationS: (distanceKm / HAND_SPEED_KMH) * 3600,
    zoneVersion,
    trace: true,
  };
}

/**
 * The starting state of the creation and the kept legs for a trace
 * (ADR 0020, sections 3 to 5). Like `reopenDraft`, the history is empty.
 * A loop starts at the point nearest to `position` (or at its beginning);
 * a one-way trace, and a GPX, start at the beginning.
 */
export function traceToDraft(
  line: readonly LonLat[],
  options: TraceOptions,
): { state: DraftState; kept: KeptLegs } {
  const { loop, position, zoneVersion, bbox } = options;
  const ordered =
    loop && position && line.length >= 2
      ? rotateLoop(line, nearestOnLine(line, position))
      : line;
  const { points, legs } = cutTrace(ordered, bbox);
  const kept = new Map<string, KeptLeg>();
  legs.forEach((piece, i) => {
    const key = legKey(
      { lon: points[i][0], lat: points[i][1] },
      { lon: points[i + 1][0], lat: points[i + 1][1] },
    );
    if (!kept.has(key)) kept.set(key, traceLeg(piece, zoneVersion));
  });
  const draftPoints = points.map(([lon, lat], i) => ({ id: i + 1, lon, lat }));
  const state: DraftState = {
    ...createDraftState(),
    draft: {
      points: draftPoints,
      modes: legs.map(() => 'path' as const),
    },
    nextId: draftPoints.length + 1,
  };
  return { state, kept };
}
