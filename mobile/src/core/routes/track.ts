// The track of a saved route: built from the legs, thinned for the engine,
// reduced for the list, and compared to a zone rectangle (ADR 0019, sections
// 5, 6 and 8). Pure logic.

import type { Draft } from '@/core/draft/draft';
import { encodePolyline6 } from '@/core/routing/routeResponse';
import type { Bbox } from '@/core/zones/catalogue';

import { trackLengthM } from '../gpx/trackLengthM';
import type { LonLat, SavedLeg } from './savedRoute';

/** Points of the preview (ADR 0019, section 1). */
export const PREVIEW_POINTS = 66;
/** Valhalla refuses `trace_attributes` above 16 000 points. */
export const MAX_ENGINE_POINTS = 14_000;

/**
 * One continuous line: the shapes of the computed legs and the points of the
 * hand legs. A hand leg that touches a computed leg goes through the end of
 * the computed shape (the snapped point), not through the point placed.
 * Two equal points in a row make one.
 */
export function trackOfCreated(draft: Draft, legs: SavedLeg[]): LonLat[] {
  const out: LonLat[] = [];
  const push = (p: LonLat) => {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  };
  legs.forEach((leg, i) => {
    if (leg.mode === 'path') {
      leg.shape.forEach(push);
      return;
    }
    const from = draft.points[i];
    const to = draft.points[i + 1];
    if (!from || !to) return;
    if (legs[i - 1]?.mode !== 'path') push([from.lon, from.lat]);
    if (legs[i + 1]?.mode !== 'path') push([to.lon, to.lat]);
  });
  return out;
}

/** Length of the track (km), on the sphere of the engine. */
export function trackLengthKm(track: readonly LonLat[]): number {
  return trackLengthM(track) / 1000;
}

/**
 * At most `max` points: a point is kept when it is farther than
 * length / max from the last kept one, plus the first and last points.
 */
export function thinTrack(track: LonLat[], max = MAX_ENGINE_POINTS): LonLat[] {
  if (track.length <= max) return track;
  const step = trackLengthM(track) / max;
  const out: LonLat[] = [track[0]];
  let since = 0;
  for (let i = 1; i < track.length - 1; i++) {
    since += trackLengthM([track[i - 1], track[i]]);
    if (since > step) {
      out.push(track[i]);
      since = 0;
    }
  }
  out.push(track[track.length - 1]);
  return out;
}

/** Encoded polyline of at most 66 points, evenly taken, ends included. */
export function previewOf(track: readonly LonLat[]): string {
  if (track.length <= PREVIEW_POINTS) return encodePolyline6([...track]);
  const picked: LonLat[] = [];
  for (let k = 0; k < PREVIEW_POINTS; k++) {
    picked.push(
      track[Math.round((k * (track.length - 1)) / (PREVIEW_POINTS - 1))],
    );
  }
  return encodePolyline6(picked);
}

export function isInside(bbox: Bbox, [lon, lat]: LonLat): boolean {
  return (
    lon >= bbox.lonMin &&
    lon <= bbox.lonMax &&
    lat >= bbox.latMin &&
    lat <= bbox.latMax
  );
}

/** True when every point of the track is inside the rectangle. */
export function trackInside(bbox: Bbox, track: readonly LonLat[]): boolean {
  return track.every((p) => isInside(bbox, p));
}
