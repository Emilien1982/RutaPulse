// Length of a track on the sphere of Valhalla (kRadEarthMeters), so that the
// length of an exported then re-imported route matches the engine's
// (ADR 0019, section 7).

export const VALHALLA_EARTH_RADIUS_M = 6378160;

/** Sum of the great-circle distances (m) between [lon, lat] points. */
export function trackLengthM(track: readonly (readonly number[])[]): number {
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    const [lon1, lat1] = track[i - 1];
    const [lon2, lat2] = track[i];
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    total += 2 * VALHALLA_EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}
