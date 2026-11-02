// What the map of the Infos screen draws and frames. Pure functions.

import type { Draft } from '@/core/draft/draft';

import type { LineCollection } from './draftGeometry';

/** [west, south, east, north] around every drawn line and every point. */
export function routeBounds(
  draft: Draft,
  lines: LineCollection,
): [number, number, number, number] | null {
  const coordinates: [number, number][] = [
    ...draft.points.map((p) => [p.lon, p.lat] as [number, number]),
    ...lines.features.flatMap((f) => f.geometry.coordinates),
  ];
  if (coordinates.length === 0) return null;
  // Loops, not `Math.min(...array)`: thousands of arguments can fail.
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of coordinates) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  const pad = 0.0005;
  return [west - pad, south - pad, east + pad, north + pad];
}

/** Start and arrival, one GeoJSON point each. */
export function endPoints(draft: Draft) {
  const first = draft.points[0];
  const last = draft.points[draft.points.length - 1];
  const feature = (role: 'start' | 'end', p: { lon: number; lat: number }) => ({
    type: 'Feature' as const,
    properties: { role },
    geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
  });
  return {
    type: 'FeatureCollection' as const,
    features:
      first && last && draft.points.length > 1
        ? [feature('start', first), feature('end', last)]
        : [],
  };
}
