// The dotted link between a touched point and the end of the drawn route
// (design/tokens.md, trace.liaison). Pure geometry, no map.

import type { RoutePoint } from './routeRequest';

/** Under this distance (m) the link is hidden by the marker anyway. */
export const MIN_LINK_METERS = 5;

const EARTH_RADIUS_M = 6371008.8;

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: RoutePoint, b: RoutePoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * The straight segments to draw: start -> first shape point, last shape
 * point -> end. A segment shorter than 5 m is left out.
 */
export function linkSegments(
  start: RoutePoint,
  end: RoutePoint,
  shape: [number, number][],
): [number, number][][] {
  const first = shape[0];
  const last = shape[shape.length - 1];
  if (!first || !last) return [];
  const segments: [number, number][][] = [];
  const add = (from: RoutePoint, to: [number, number]) => {
    if (distanceMeters(from, { lon: to[0], lat: to[1] }) < MIN_LINK_METERS) {
      return;
    }
    segments.push([[from.lon, from.lat], to]);
  };
  add(start, first);
  // Reversed on purpose: the arrival segment goes from the route to the end.
  const toEnd = { lon: last[0], lat: last[1] };
  if (distanceMeters(toEnd, end) >= MIN_LINK_METERS) {
    segments.push([last, [end.lon, end.lat]]);
  }
  return segments;
}
