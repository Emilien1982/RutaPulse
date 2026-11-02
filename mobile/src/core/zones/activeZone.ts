// The zone shown by the map: ADR 0013, section 8.

import type { Bbox, Zone } from './catalogue';
import type { ReadyMarker } from './zoneLayout';

/**
 * The zone the app should use (ADR 0018, section 3): for each `id`, only the
 * greatest ready version counts; among those zones, the one installed most
 * recently. Null when there is none.
 */
export function pickActiveZone(installed: ReadyMarker[]): Zone | null {
  const latestById = new Map<string, ReadyMarker>();
  for (const marker of installed) {
    const known = latestById.get(marker.zone.id);
    if (!known || marker.zone.version > known.zone.version) {
      latestById.set(marker.zone.id, marker);
    }
  }
  let best: ReadyMarker | null = null;
  for (const marker of latestById.values()) {
    if (
      !best ||
      Date.parse(marker.installedAt) > Date.parse(best.installedAt)
    ) {
      best = marker;
    }
  }
  return best ? best.zone : null;
}

/** True when the point is inside the zone rectangle, edges included. */
export function isInsideBbox(bbox: Bbox, lon: number, lat: number): boolean {
  return (
    lon >= bbox.lonMin &&
    lon <= bbox.lonMax &&
    lat >= bbox.latMin &&
    lat <= bbox.latMax
  );
}

/** The point of the zone rectangle closest to the given point. */
export function clampToBbox(
  bbox: Bbox,
  lon: number,
  lat: number,
): [number, number] {
  return [
    Math.min(Math.max(lon, bbox.lonMin), bbox.lonMax),
    Math.min(Math.max(lat, bbox.latMin), bbox.latMax),
  ];
}
