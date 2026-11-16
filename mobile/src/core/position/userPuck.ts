// The blue dot of the user: heading arrow and accuracy halo (ADR 0021,
// section 9). Pure logic, no map.

/** Under this speed (m/s) the heading of the GPS is too noisy. */
export const MIN_HEADING_SPEED_MS = 0.5;
/** The arrow goes away after this long (ms) under that speed. */
export const SLOW_HIDE_MS = 5_000;

export type HeadingState = {
  /** The heading shown (degrees, 0 = north), or null: no arrow. */
  heading: number | null;
  /** Time (ms) the speed fell under the minimum, or null. */
  slowSince: number | null;
};

/**
 * The heading of the arrow after a position. `coords.heading` is the course
 * of the GPS (iOS gives -1, Android 0 with a null speed when it has none).
 * Without a valid heading: no arrow at once. Under 0.5 m/s: the last heading
 * is kept, and the arrow goes away after more than 5 s.
 */
export function nextHeading(
  state: HeadingState,
  coords: { heading: number | null; speed: number | null },
  at: number,
): HeadingState {
  const { heading, speed } = coords;
  if (
    heading === null ||
    heading === undefined ||
    !Number.isFinite(heading) ||
    heading < 0 ||
    heading > 360
  ) {
    return { heading: null, slowSince: null };
  }
  const slow =
    speed !== null &&
    speed !== undefined &&
    Number.isFinite(speed) &&
    speed < MIN_HEADING_SPEED_MS;
  if (!slow) return { heading, slowSince: null };
  const slowSince = state.slowSince ?? at;
  return {
    heading: at - slowSince > SLOW_HIDE_MS ? null : state.heading,
    slowSince,
  };
}

/** Meters on the ground of one point of the screen (tiles of 512 points). */
export function metersPerPoint(zoom: number, latitude: number): number {
  return (78271.517 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * The radius of the halo (in points) at zoom 0: the accuracy in meters over
 * the meters of one point at zoom 0. The map doubles it at each zoom.
 */
export function haloRadiusAtZoom0(accuracyM: number, latitude: number): number {
  return accuracyM / metersPerPoint(0, latitude);
}

export type PuckFeature = {
  type: 'Feature';
  properties: { r0?: number; heading?: number };
  geometry: { type: 'Point'; coordinates: [number, number] };
};

/**
 * The point drawn by the layers of the dot. `r0` (halo) is left out when the
 * accuracy is unknown, `heading` (arrow) when there is no heading.
 */
export function puckFeature(
  at: { longitude: number; latitude: number; accuracy?: number | null },
  heading: number | null,
): PuckFeature {
  const properties: PuckFeature['properties'] = {};
  if (
    at.accuracy !== null &&
    at.accuracy !== undefined &&
    Number.isFinite(at.accuracy) &&
    at.accuracy > 0
  ) {
    properties.r0 = haloRadiusAtZoom0(at.accuracy, at.latitude);
  }
  if (heading !== null) properties.heading = heading;
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates: [at.longitude, at.latitude] },
  };
}
