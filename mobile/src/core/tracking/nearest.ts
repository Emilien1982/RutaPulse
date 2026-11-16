// Where a point is on the line (ADR 0021, section 2.2). One primitive,
// `nearestOnLine`, serves the GPS position, the maneuvers and the control of
// the answer of the engine. Distances are measured in the local plane of the
// line; the distance along the line is on the sphere of the engine.

import type { LonLat } from '@/core/routes/savedRoute';

import { bearingBetween, type TrackingLine, toPlane } from './trackingLine';

export type Nearest = {
  /** Distance along the line (m). */
  alongM: number;
  /** Distance from the point to the line (m). */
  gapM: number;
  /** Bearing of the segment (degrees). */
  bearing: number;
  /** The point of the line. */
  point: LonLat;
};

/** The first segment that ends at or after `fromM`. */
function firstSegment(line: TrackingLine, fromM: number): number {
  let lo = 0;
  let hi = line.points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((line.cumM[mid + 1] as number) < fromM) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo);
}

/** The closest point of the segment i..i+1. */
function onSegment(
  line: TrackingLine,
  i: number,
  px: number,
  py: number,
): Nearest {
  const ax = line.xs[i] as number;
  const ay = line.ys[i] as number;
  const dx = (line.xs[i + 1] as number) - ax;
  const dy = (line.ys[i + 1] as number) - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const a = line.points[i] as LonLat;
  const b = line.points[i + 1] as LonLat;
  const startM = line.cumM[i] as number;
  return {
    alongM: startM + t * ((line.cumM[i + 1] as number) - startM),
    gapM: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)),
    bearing: bearingBetween(a, b),
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
  };
}

/**
 * The point of the line closest to `point`, searched only on the segments
 * between the distances `fromM` and `toM`. Null when the line has no segment.
 */
export function nearestOnLine(
  line: TrackingLine,
  point: LonLat,
  fromM: number,
  toM: number,
): Nearest | null {
  const [px, py] = toPlane(line, point);
  let best: Nearest | null = null;
  for (
    let i = firstSegment(line, fromM);
    i < line.points.length - 1 && (line.cumM[i] as number) <= toM;
    i++
  ) {
    const found = onSegment(line, i, px, py);
    if (!best || found.gapM < best.gapM) best = found;
  }
  return best;
}

/**
 * The passages of the line within `radiusM` of the point, in the order of the
 * line. A passage is the best point of a stretch of segments where the gap
 * goes down then up again; two arms of a hairpin are two passages.
 */
export function passagesNear(
  line: TrackingLine,
  point: LonLat,
  radiusM: number,
  fromM = 0,
  toM = line.lengthM,
): Nearest[] {
  const [px, py] = toPlane(line, point);
  const found: Nearest[] = [];
  for (
    let i = firstSegment(line, fromM);
    i < line.points.length - 1 && (line.cumM[i] as number) <= toM;
    i++
  ) {
    found.push(onSegment(line, i, px, py));
  }
  const passages: Nearest[] = [];
  found.forEach((n, k) => {
    const before = found[k - 1];
    const after = found[k + 1];
    if (
      n.gapM <= radiusM &&
      (!before || n.gapM <= before.gapM) &&
      (!after || n.gapM < after.gapM)
    ) {
      passages.push(n);
    }
  });
  return passages;
}

/** Weight of the distance to the expected place, against the gap (ADR 0021, 2.3). */
export const EXPECTED_WEIGHT = 0.5;

/**
 * Among the passages within `maxGapM` in the window, the one with the lowest
 * `gapM + 0.5 × |alongM − expectedM|`: the one that follows the movement.
 */
export function bestInWindow(
  line: TrackingLine,
  point: LonLat,
  fromM: number,
  toM: number,
  expectedM: number,
  maxGapM: number,
): Nearest | null {
  let best: Nearest | null = null;
  let bestScore = Infinity;
  for (const n of passagesNear(line, point, maxGapM, fromM, toM)) {
    const score = n.gapM + EXPECTED_WEIGHT * Math.abs(n.alongM - expectedM);
    if (score < bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return best;
}
