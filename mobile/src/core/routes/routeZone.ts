// State of the zone of a saved route (ADR 0019, section 6). Pure logic.

import type { Bbox } from '@/core/zones/catalogue';

import type { GpxRoute, SavedRoute } from './savedRoute';
import { isInside, trackInside } from './track';

export type RouteZoneStatus =
  'usable' | 'leaves' | 'outside' | 'deleted' | 'notInService';

type ZoneRef = { id: string; bbox: Bbox };

/**
 * `inService`: the zone the engine reads (null: none). `installed`: the ready
 * zones. A created route keeps its zone even if a hand leg leaves it.
 */
export function routeZoneStatus(
  route: Pick<SavedRoute, 'zone' | 'origin'> & { track?: GpxRoute['track'] },
  inService: ZoneRef | null,
  installed: readonly { id: string }[],
): RouteZoneStatus {
  if (!route.zone) return 'outside';
  const zoneId = route.zone.id;
  if (!installed.some((z) => z.id === zoneId)) return 'deleted';
  if (!inService || inService.id !== zoneId) return 'notInService';
  if (route.origin === 'gpx' && route.track) {
    return trackInside(inService.bbox, route.track) ? 'usable' : 'leaves';
  }
  return 'usable';
}

/** A GPX without zone whose start is inside the zone in service takes it. */
export function canAttachZone(route: SavedRoute, zone: ZoneRef | null) {
  return (
    zone !== null &&
    route.readable &&
    route.origin === 'gpx' &&
    route.zone === null &&
    route.track.length > 0 &&
    isInside(zone.bbox, route.track[0])
  );
}
