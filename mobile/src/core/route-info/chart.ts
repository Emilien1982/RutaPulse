// Geometry of the elevation profile (mockup 20). Pure functions: the screen
// only draws what they return.

/** Smallest altitude span drawn: a flat route stays flat. */
export const MIN_SPAN_M = 20;
/** Free space above the highest point and below the lowest one. */
const MARGIN = 3;

export type ChartPoint = { x: number; y: number };

/**
 * Points of the line, `width` wide and `height` high (y grows downward).
 * The lowest altitude sits at the bottom, the highest at the top.
 */
export function chartPoints(
  profile: [number, number][],
  minM: number,
  maxM: number,
  width: number,
  height: number,
): ChartPoint[] {
  const length = profile[profile.length - 1]?.[0] ?? 0;
  const span = Math.max(maxM - minM, MIN_SPAN_M);
  const room = height - 2 * MARGIN;
  return profile.map(([distance, altitude]) => ({
    x: length > 0 ? (distance / length) * width : 0,
    y: height - MARGIN - ((altitude - minM) / span) * room,
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
