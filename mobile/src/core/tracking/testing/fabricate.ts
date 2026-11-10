// Lines and GPS traces made in meters, for the tests of the tracking (ADR
// 0021, section 7). A plane with x to the east and y to the north, around
// Nancy. Not used by the app.

import { VALHALLA_EARTH_RADIUS_M } from '@/core/gpx/trackLengthM';
import type { LonLat } from '@/core/routes/savedRoute';

import type { Fix } from '../placement';

export type XY = [number, number];

const ORIGIN: LonLat = [6.0, 48.7];
const M_PER_DEG = (Math.PI / 180) * VALHALLA_EARTH_RADIUS_M;

export function toLonLat([x, y]: XY): LonLat {
  return [
    ORIGIN[0] + x / (M_PER_DEG * Math.cos((ORIGIN[1] * Math.PI) / 180)),
    ORIGIN[1] + y / M_PER_DEG,
  ];
}

export function lineOf(path: XY[]): LonLat[] {
  return path.map(toLonLat);
}

export function pathLength(path: XY[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(
      (path[i] as XY)[0] - (path[i - 1] as XY)[0],
      (path[i] as XY)[1] - (path[i - 1] as XY)[1],
    );
  }
  return total;
}

/** The point of the path at distance `d` (kept between the ends). */
export function pointAlong(path: XY[], d: number): XY {
  let left = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as XY;
    const b = path[i] as XY;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len || i === path.length - 1) {
      const f = len > 0 ? Math.min(1, left / len) : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    left -= len;
  }
  return path[0] ?? [0, 0];
}

/** A path with a point every `stepM` meters (a real track has many points). */
export function dense(path: XY[], stepM = 10): XY[] {
  const total = pathLength(path);
  const out: XY[] = [];
  for (let d = 0; d < total; d += stepM) out.push(pointAlong(path, d));
  out.push(pointAlong(path, total));
  return out;
}

/** Straight line to the east. */
export function straight(lengthM: number): XY[] {
  return [
    [0, 0],
    [lengthM, 0],
  ];
}

/** A circle that starts and ends at (radius, 0): a loop whose end is its start. */
export function loop(radiusM: number, points = 120): XY[] {
  const out: XY[] = [];
  for (let k = 0; k <= points; k++) {
    const a = (2 * Math.PI * k) / points;
    out.push([radiusM * Math.cos(a), radiusM * Math.sin(a)]);
  }
  return out;
}

/** Out to `lengthM` and back on the very same path. */
export function outAndBack(lengthM: number): XY[] {
  return [
    [0, 0],
    [lengthM, 0],
    [0, 0],
  ];
}

/**
 * A figure eight: two circles that cross once in the middle, starting and
 * ending there. Both passages at the crossing are at 0 m from each other.
 */
export function figureEight(radiusM: number, points = 80): XY[] {
  const out: XY[] = [];
  for (let k = 0; k <= points; k++) {
    const a = (2 * Math.PI * k) / points;
    out.push([radiusM * (Math.cos(a) - 1), radiusM * Math.sin(a)]);
  }
  for (let k = 0; k <= points; k++) {
    const a = Math.PI - (2 * Math.PI * k) / points;
    out.push([radiusM * (Math.cos(a) + 1), radiusM * Math.sin(a)]);
  }
  return out;
}

/** Switchbacks: the path goes east, turns, goes back west `gapM` farther north, and so on. */
export function switchbacks(legM: number, gapM: number, legs: number): XY[] {
  const out: XY[] = [];
  for (let k = 0; k < legs; k++) {
    const y = k * gapM;
    out.push(k % 2 === 0 ? [0, y] : [legM, y]);
    out.push(k % 2 === 0 ? [legM, y] : [0, y]);
  }
  return out;
}

/** Small seeded random generator (mulberry32): the same numbers at each run. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RideOptions = {
  /** m/s. Default 5. */
  speed?: number;
  /** Largest GPS error (m). Default 0. */
  noiseM?: number;
  seed?: number;
  /** ms. Default 1 700 000 000 000. */
  startAt?: number;
  /** Start and end of the ride along the path (m). */
  fromM?: number;
  toM?: number;
  /** Reported precision (m). Default 5. */
  accuracy?: number;
};

/** One position per second along the path, with an error inside a disc. */
export function rideAlong(path: XY[], options: RideOptions = {}): Fix[] {
  const {
    speed = 5,
    noiseM = 0,
    seed = 1,
    startAt = 1_700_000_000_000,
  } = options;
  const { fromM = 0, toM = pathLength(path), accuracy = 5 } = options;
  const rand = random(seed);
  const fixes: Fix[] = [];
  for (let k = 0; fromM + k * speed <= toM + 1e-9; k++) {
    const [x, y] = pointAlong(path, fromM + k * speed);
    const r = noiseM * Math.sqrt(rand());
    const a = 2 * Math.PI * rand();
    const [lon, lat] = toLonLat([x + r * Math.cos(a), y + r * Math.sin(a)]);
    fixes.push({ lon, lat, accuracy, at: startAt + k * 1000 });
  }
  return fixes;
}
