// The list of directions of a line, written from the answers of the engine
// (ADR 0021, sections 1.3 to 1.6). The engine is asked at the start of the
// tracking, once per guided part; this file checks what it answers and
// turns it into our directions. Pure logic.

import type {
  MatchedEdgesResult,
  Maneuver,
  TraceRouteResult,
} from '@/core/routing/guidanceResponse';
import { classifyEdge } from '@/core/route-info/terrain';
import type { LonLat } from '@/core/routes/savedRoute';
import { spaceEvery } from '@/core/routes/track';

import type { Direction, Gesture, Side, Way } from './directionText';
import { bestInWindow, nearestOnLine } from './nearest';
import {
  angleDiff,
  bearingBetween,
  buildLine,
  guidedParts,
  normalizeFree,
  pointAt,
  sliceLine,
  type FreePart,
  type TrackingLine,
  type TrackingSource,
} from './trackingLine';

/** Distance between the points sent to the engine (m). */
export const REQUEST_STEP_M = 20;
/** Distance between the points that check the answer (m). */
export const CHECK_STEP_M = 10;
/** A point farther than this (m) from the matched shape is not matched... */
export const MATCH_GAP_M = 20;
/** ... when this many meters in a row are not. */
export const MATCH_RUN_M = 100;
/** A maneuver farther than this (m) from our line is dropped. */
export const MANEUVER_GAP_M = 20;
/** A U-turn is kept when the line turns back by more than this (degrees)... */
export const UTURN_MIN_ANGLE = 150;
/** ... measured this far (m) before and after it. */
export const UTURN_SPAN_M = 20;

/** What the engine answered for one guided part; null parts have no answer. */
export type PartAnswer = {
  trace: TraceRouteResult | null;
  edges: MatchedEdgesResult | null;
};

/** The shape to send to the engine for a part: one point every 20 m. */
export function partShape(
  line: TrackingLine,
  part: { fromM: number; toM: number },
): [number, number][] {
  return spaceEvery(sliceLine(line, part.fromM, part.toM), REQUEST_STEP_M);
}

/** Gesture and side of a Valhalla maneuver type; null when it is dropped. */
export function gestureOfType(
  type: number,
): { gesture: Gesture; side?: Side } | null {
  switch (type) {
    case 9:
    case 18:
    case 20:
    case 37:
      return { gesture: 'slight', side: 'right' };
    case 16:
    case 19:
    case 21:
    case 38:
      return { gesture: 'slight', side: 'left' };
    case 10:
      return { gesture: 'turn', side: 'right' };
    case 15:
      return { gesture: 'turn', side: 'left' };
    case 11:
      return { gesture: 'sharp', side: 'right' };
    case 14:
      return { gesture: 'sharp', side: 'left' };
    case 23:
      return { gesture: 'fork', side: 'right' };
    case 24:
      return { gesture: 'fork', side: 'left' };
    case 22:
      return { gesture: 'straight' };
    case 12:
      return { gesture: 'uturn', side: 'right' };
    case 13:
      return { gesture: 'uturn', side: 'left' };
    case 26:
      return { gesture: 'roundabout' };
    default:
      return null;
  }
}

/**
 * Stretches of the part that the engine did not match: the points of the
 * part, every 10 m, farther than 20 m from the matched shape, for more than
 * 100 m. The matched shape is followed with the progress, like a position.
 */
function unmatchedParts(
  line: TrackingLine,
  part: { fromM: number; toM: number },
  matched: TrackingLine,
): FreePart[] {
  const out: FreePart[] = [];
  let progress = 0;
  let lastGood = 0;
  let runStart: number | null = null;
  let runEnd = 0;
  const close = (endM: number) => {
    if (runStart !== null && runEnd - runStart > MATCH_RUN_M) {
      out.push({ fromM: runStart, toM: endM, reason: 'noMatch' });
    }
    runStart = null;
  };
  const length = part.toM - part.fromM;
  for (let rel = 0; ; rel = Math.min(rel + CHECK_STEP_M, length)) {
    const m = part.fromM + rel;
    const found = nearestOnLine(
      matched,
      pointAt(line, m),
      progress - 50,
      progress + 500 + (rel - lastGood),
    );
    if (found && found.gapM <= MATCH_GAP_M) {
      close(m);
      progress = found.alongM;
      lastGood = rel;
    } else {
      if (runStart === null) runStart = m;
      runEnd = m;
    }
    if (rel >= length) break;
  }
  close(part.toM);
  return out;
}

/** Number of points the two shapes have in common at their start. */
function commonStart(a: readonly LonLat[], b: readonly LonLat[]): number {
  let k = 0;
  while (
    k < a.length &&
    k < b.length &&
    (a[k] as LonLat)[0] === (b[k] as LonLat)[0] &&
    (a[k] as LonLat)[1] === (b[k] as LonLat)[1]
  ) {
    k++;
  }
  return k;
}

/** True when the line turns back at `atM` (the U-turn is not a ghost). */
function turnsBack(line: TrackingLine, atM: number): boolean {
  const here = pointAt(line, atM);
  const before = bearingBetween(pointAt(line, atM - UTURN_SPAN_M), here);
  const after = bearingBetween(here, pointAt(line, atM + UTURN_SPAN_M));
  return angleDiff(before, after) > UTURN_MIN_ANGLE;
}

/** The directions of one guided part, and the stretches the engine missed. */
function guidePart(
  line: TrackingLine,
  part: { fromM: number; toM: number },
  answer: PartAnswer | null | undefined,
): { turns: Direction[]; lost: FreePart[] } {
  const trace = answer?.trace;
  if (!trace || !trace.ok) {
    return {
      turns: [],
      lost: [{ fromM: part.fromM, toM: part.toM, reason: 'noMatch' }],
    };
  }
  const matched = buildLine(trace.shape);
  const lost = unmatchedParts(line, part, matched);

  // The ways, where their indices are those of the shape of the maneuvers.
  const edges = answer?.edges;
  const sameStart =
    edges && edges.ok ? commonStart(trace.shape, edges.shape) : 0;
  const wayAt = new Map<number, Way>();
  if (edges && edges.ok) {
    for (const edge of edges.edges) {
      if (edge.beginShapeIndex < sameStart) {
        wayAt.set(
          edge.beginShapeIndex,
          classifyEdge({ use: edge.use, density: edge.density, lengthKm: 0 }),
        );
      }
    }
  }

  const turns: Direction[] = [];
  let lastM = part.fromM;
  let lastMatchedM = 0;
  trace.maneuvers.forEach((maneuver: Maneuver) => {
    const kind = gestureOfType(maneuver.type);
    const at = matched.points[maneuver.beginShapeIndex];
    if (!kind || !at) return;
    const matchedM = matched.cumM[maneuver.beginShapeIndex] as number;
    const step = Math.max(0, matchedM - lastMatchedM);
    const found = bestInWindow(
      line,
      at,
      Math.max(part.fromM, lastM - 50),
      Math.min(part.toM, lastM + step * 1.5 + 500),
      lastM + step,
      MANEUVER_GAP_M,
    );
    if (!found) return;
    lastM = found.alongM;
    lastMatchedM = matchedM;
    if (kind.gesture === 'uturn' && !turnsBack(line, found.alongM)) return;
    const way = wayAt.get(maneuver.beginShapeIndex);
    const withWay =
      way && kind.gesture !== 'uturn' && kind.gesture !== 'roundabout';
    turns.push({
      kind: 'turn',
      atM: found.alongM,
      gesture: kind.gesture,
      ...(kind.side ? { side: kind.side } : {}),
      ...(kind.gesture === 'roundabout'
        ? { exit: maneuver.exitCount ?? 1 }
        : {}),
      ...(withWay ? { way } : {}),
    });
  });
  return { turns, lost };
}

/**
 * The directions along the line, in order: turns, "follow the track" for the
 * free stretches (by hand, out of the zone, not matched), and the arrival at
 * the end of our line. `answers[k]` is the answer for the k-th guided part
 * (`guidedParts`); a missing or failed answer makes the part free.
 */
export function buildGuidance(
  source: TrackingSource,
  answers: readonly (PartAnswer | null | undefined)[],
): Direction[] {
  const { line } = source;
  const turns: Direction[] = [];
  const lost: FreePart[] = [];
  guidedParts(line, source.free).forEach((part, k) => {
    const done = guidePart(line, part, answers[k]);
    turns.push(...done.turns);
    lost.push(...done.lost);
  });
  const free = normalizeFree([...source.free, ...lost]);
  const inFree = (m: number) => free.some((f) => m > f.fromM && m < f.toM);
  const all: { at: number; direction: Direction }[] = [
    ...turns
      .filter((d) => d.kind === 'turn' && !inFree(d.atM))
      .map((direction) => ({
        at: direction.kind === 'turn' ? direction.atM : 0,
        direction,
      })),
    ...free.map((f) => ({
      at: f.fromM,
      direction: { kind: 'follow', ...f } as Direction,
    })),
  ];
  all.sort((a, b) => a.at - b.at);
  return [
    ...all.map((item) => item.direction),
    { kind: 'arrive', atM: line.lengthM },
  ];
}
