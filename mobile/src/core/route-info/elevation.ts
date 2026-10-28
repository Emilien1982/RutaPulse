// Ascent and descent of a list of altitudes (ADR 0017, section 4). Same
// method as essay 1 and `comparer.py` of the T1 trial.

/** A change smaller than this (m) is noise and is not counted. */
export const ELEVATION_THRESHOLD_M = 5;

function climb(heights: number[]): number {
  const first = heights[0];
  if (first === undefined) return 0;
  let ref = first;
  let total = 0;
  for (let i = 1; i < heights.length; i++) {
    const h = heights[i] as number;
    if (h - ref >= ELEVATION_THRESHOLD_M) {
      total += h - ref;
      ref = h;
    } else if (ref - h >= ELEVATION_THRESHOLD_M) {
      ref = h;
    }
  }
  return total;
}

/** D+ and D- in meters. The threshold has a memory: never sum per leg. */
export function ascentDescent(heights: number[]): {
  ascentM: number;
  descentM: number;
} {
  return { ascentM: climb(heights), descentM: climb(heights.map((h) => -h)) };
}
