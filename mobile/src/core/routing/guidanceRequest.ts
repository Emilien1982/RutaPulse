// Valhalla requests for the directions of the tracking (ADR 0021, section
// 1.1). The shape is a list of [lon, lat] points, already spaced.

import { ROUTE_COSTING } from './routeRequest';
import { encodePolyline6 } from './routeResponse';

/** JSON text of the `trace_route` request: matches the shape, gives the directions. */
export function buildTraceRouteRequest(shape: [number, number][]): string {
  return JSON.stringify({
    encoded_polyline: encodePolyline6(shape),
    shape_match: 'map_snap',
    ...ROUTE_COSTING,
    directions_options: { language: 'fr-FR', units: 'kilometers' },
  });
}

/** JSON text of the `trace_attributes` request: the kind of way under each part of the shape. */
export function buildMatchedEdgesRequest(shape: [number, number][]): string {
  return JSON.stringify({
    encoded_polyline: encodePolyline6(shape),
    shape_match: 'map_snap',
    ...ROUTE_COSTING,
    filters: {
      attributes: [
        'edge.use',
        'edge.density',
        'edge.begin_shape_index',
        'shape',
      ],
      action: 'include',
    },
  });
}
