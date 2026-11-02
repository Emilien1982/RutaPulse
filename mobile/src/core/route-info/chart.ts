// Geometry of the elevation profile (mockup 20). Pure functions: the screen
// only draws what they return.

/** Smallest altitude span shown: a flat route stays flat. */
export const MIN_SPAN_M = 100;
/** Share of the height left under the lowest altitude. */
const BOTTOM_SHARE = 0.12;
/** Share of the scale taken by the span shown (the rest is room above). */
const SPAN_SHARE = 0.85;

/** Scale of the profile: altitude at the bottom, and height of the scale. */
export function profileScale(
  minM: number,
  maxM: number,
): { lowM: number; spanM: number } {
  const spanM = Math.max(maxM - minM, MIN_SPAN_M) / SPAN_SHARE;
  return { lowM: minM - BOTTOM_SHARE * spanM, spanM };
}

export type ChartPoint = { x: number; y: number };

/**
 * Points of the line, `width` wide and `height` high (y grows downward).
 * The scale spans at least 100 m, with 12 % of room under the lowest point.
 */
export function chartPoints(
  profile: [number, number][],
  minM: number,
  maxM: number,
  width: number,
  height: number,
): ChartPoint[] {
  const length = profile[profile.length - 1]?.[0] ?? 0;
  const { lowM, spanM } = profileScale(minM, maxM);
  return profile.map(([distance, altitude]) => ({
    x: length > 0 ? (distance / length) * width : 0,
    y: height - ((altitude - lowM) / spanM) * height,
  }));
}

const STEPS_KM = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

/** Distances (km) of the labels under the profile: 0, then a round step. */
export function axisTicks(totalKm: number): number[] {
  if (!(totalKm > 0)) return [0];
  const step = STEPS_KM.find((s) => totalKm / s <= 5.5) ?? 100;
  const ticks: number[] = [];
  for (let k = 0; k * step <= totalKm + 1e-9; k++) {
    ticks.push(Math.round(k * step * 10) / 10);
  }
  return ticks;
}
