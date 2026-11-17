// How the map tab opens on the position of the user (ADR 0021, section 9.5).
// Pure logic, no map.

import { distanceMeters } from '@/core/routing/routeLink';

import { clampToBbox, isInsideBbox } from './activeZone';
import type { Bbox } from './catalogue';

/** Out of the zone, this close (m) to its edge, the map frames both. */
export const NEAR_ZONE_M = 10_000;
/** The framing of a position out of the zone never zooms in more than this. */
export const NEAR_MAX_ZOOM = 14;
/** How far the center is moved inside the zone from its edge (degrees). */
const INSET_DEGREES = 0.000001;

export type OpeningPlan =
  | { kind: 'inside' }
  | { kind: 'near'; edge: [number, number] }
  | { kind: 'far' };

/**
 * Inside the zone rectangle; or out of it, `near` (10 km or less from the
 * closest point of the rectangle, the `edge`); or `far`.
 */
export function openingPlan(bbox: Bbox, lon: number, lat: number): OpeningPlan {
  if (isInsideBbox(bbox, lon, lat)) return { kind: 'inside' };
  const edge = clampToBbox(bbox, lon, lat);
  const meters = distanceMeters({ lon, lat }, { lon: edge[0], lat: edge[1] });
  return meters <= NEAR_ZONE_M ? { kind: 'near', edge } : { kind: 'far' };
}

/**
 * The center of the camera for a `near` plan: the edge, moved about 0.1 m
 * inside the zone so that it never depends on a comparison on the edge.
 */
export function nearCenter(
  bbox: Bbox,
  edge: [number, number],
): [number, number] {
  const lon =
    edge[0] <= bbox.lonMin
      ? bbox.lonMin + INSET_DEGREES
      : edge[0] >= bbox.lonMax
        ? bbox.lonMax - INSET_DEGREES
        : edge[0];
  const lat =
    edge[1] <= bbox.latMin
      ? bbox.latMin + INSET_DEGREES
      : edge[1] >= bbox.latMax
        ? bbox.latMax - INSET_DEGREES
        : edge[1];
  return [lon, lat];
}

// Web Mercator at zoom 0: a world of 512 points.
function worldX(lon: number): number {
  return ((lon + 180) / 360) * 512;
}

function worldY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 512;
}

/**
 * The zoom of a `near` framing, centered on `edge`: the highest (14 at most)
 * that keeps the position `keep.side` from the left and right edges of the
 * map, `keep.top` from the top, and `keep.bottom` from the bottom.
 */
export function nearZoom(
  edge: [number, number],
  position: [number, number],
  map: { width: number; height: number },
  keep: { side: number; top: number; bottom: number },
): number {
  const dx0 = worldX(position[0]) - worldX(edge[0]);
  const dy0 = worldY(position[1]) - worldY(edge[1]);
  let zoom = NEAR_MAX_ZOOM;
  if (dx0 !== 0) {
    const room = Math.max(map.width / 2 - keep.side, 1);
    zoom = Math.min(zoom, Math.log2(room / Math.abs(dx0)));
  }
  if (dy0 !== 0) {
    // y grows to the south: a negative offset is above the center.
    const room = Math.max(
      map.height / 2 - (dy0 < 0 ? keep.top : keep.bottom),
      1,
    );
    zoom = Math.min(zoom, Math.log2(room / Math.abs(dy0)));
  }
  return zoom;
}
