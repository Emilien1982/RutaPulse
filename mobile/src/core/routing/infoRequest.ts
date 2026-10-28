// Valhalla requests for the altitudes and the terrain of a shape (ADR 0017,
// section 1). The shape is a list of [lon, lat] points.

import { ROUTE_COSTING } from './routeRequest';
import { encodePolyline6 } from './routeResponse';

/** Distance between two altitudes (ADR 0017, essai 1). */
export const HEIGHT_RESAMPLE_M = 30;

/** JSON text of the `height` request: one altitude every 30 m, with distances. */
export function buildHeightRequest(shape: [number, number][]): string {
  return JSON.stringify({
    encoded_polyline: encodePolyline6(shape),
    resample_distance: HEIGHT_RESAMPLE_M,
    range: true,
  });
}

/** JSON text of the `trace_attributes` request: only what the terrain needs. */
export function buildTraceRequest(shape: [number, number][]): string {
  return JSON.stringify({
    encoded_polyline: encodePolyline6(shape),
    ...ROUTE_COSTING,
    shape_match: 'walk_or_snap',
    filters: {
      attributes: ['edge.use', 'edge.density', 'edge.length'],
      action: 'include',
    },
  });
}
