import { isInsideBbox } from './activeZone';
import type { Zone } from './catalogue';

/** The zones of the catalogue whose rectangle holds the point. */
export function zonesCovering(
  zones: readonly Zone[],
  lon: number,
  lat: number,
): Zone[] {
  return zones.filter((zone) => isInsideBbox(zone.bbox, lon, lat));
}
