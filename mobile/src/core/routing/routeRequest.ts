// Valhalla request for a bicycle route (ADR 0002, C4; ADR 0015, section 1).

export type RoutePoint = { lon: number; lat: number };

/** A point farther than this from a path is refused by Valhalla (ADR 0016). */
export const MAX_SNAP_METERS = 200;

/** JSON text of the request. First and last points are `break`, others `through`. */
export function buildRouteRequest(points: RoutePoint[]): string {
  const last = points.length - 1;
  return JSON.stringify({
    locations: points.map((p, i) => ({
      lat: p.lat,
      lon: p.lon,
      type: i === 0 || i === last ? 'break' : 'through',
      search_cutoff: MAX_SNAP_METERS,
    })),
    costing: 'bicycle',
    costing_options: { bicycle: { bicycle_type: 'mountain', use_roads: 0 } },
    directions_options: { language: 'fr-FR', units: 'kilometers' },
  });
}
