// Shape to send to `height` for one leg (ADR 0017, section 5).

import type { Bbox } from '../zones/catalogue';
import { isInsideBbox } from '../zones/activeZone';
import type { Leg } from '../draft/legs';

/**
 * A calculated leg: the shape of its route (null while unknown). A hand leg:
 * the straight line, or null when an end is outside the zone rectangle
 * (no call, altitudes missing).
 */
export function infoShape(
  leg: Leg,
  route: { shape: [number, number][] } | undefined,
  bbox: Bbox,
): [number, number][] | null {
  if (leg.mode === 'path') return route ? route.shape : null;
  const { from, to } = leg;
  if (!isInsideBbox(bbox, from.lon, from.lat)) return null;
  if (!isInsideBbox(bbox, to.lon, to.lat)) return null;
  return [
    [from.lon, from.lat],
    [to.lon, to.lat],
  ];
}
