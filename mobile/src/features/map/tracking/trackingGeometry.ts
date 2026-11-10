// What the tracking draws and where the camera looks (ADR 0021, section 3).
// Pure logic: the components only hand it to MapLibre.

import { cameraBearing, type Placement } from '@/core/tracking/placement';
import {
  buildLine,
  pointAt,
  sliceLine,
  type FreePart,
  type TrackingLine,
} from '@/core/tracking/trackingLine';
import type { LonLat } from '@/core/routes/savedRoute';
import { thinTrack } from '@/core/routes/track';

import type { LineCollection } from '../draftGeometry';

/** Points of the line that is drawn, at most (ADR 0021, section 3). */
export const MAX_DRAWN_POINTS = 5_000;
/** The map zoom on the road, and within 100 m of a direction. */
export const ZOOM_ROAD = 15.5;
export const ZOOM_NEAR = 16.5;
/** The camera comes back this long (ms) after the last gesture. */
export const GESTURE_PAUSE_MS = 10_000;
/** The line is drawn again when the progress moved by this much (m). */
export const REDRAW_M = 10;

/** The line as it is drawn, with the hand stretches along it. */
export type DrawnLine = { line: TrackingLine; hand: FreePart[] };

/** The line thinned for the map; the hand stretches follow its own distances. */
export function drawnLine(line: TrackingLine, free: FreePart[]): DrawnLine {
  const drawn =
    line.points.length > MAX_DRAWN_POINTS
      ? buildLine(thinTrack(line.points, MAX_DRAWN_POINTS))
      : line;
  const scale = line.lengthM > 0 ? drawn.lengthM / line.lengthM : 1;
  return {
    line: drawn,
    hand: free
      .filter((f) => f.reason === 'hand')
      .map((f) => ({ ...f, fromM: f.fromM * scale, toM: f.toM * scale })),
  };
}

const EMPTY: LineCollection = { type: 'FeatureCollection', features: [] };

function feature(mode: 'path' | 'hand', coordinates: LonLat[]) {
  return {
    type: 'Feature' as const,
    properties: { mode },
    geometry: { type: 'LineString' as const, coordinates },
  };
}

/**
 * The part already ridden (grey) and the part left (by mode: plain, or
 * dashes for a hand stretch), cut at `progressM`.
 */
export function ridePieces(
  drawn: DrawnLine,
  progressM: number,
): { done: LineCollection; todo: LineCollection } {
  const { line, hand } = drawn;
  const at = Math.min(Math.max(progressM, 0), line.lengthM);
  const done =
    at > 0
      ? { ...EMPTY, features: [feature('path', sliceLine(line, 0, at))] }
      : EMPTY;
  const features: LineCollection['features'] = [];
  let from = at;
  for (const part of hand) {
    if (part.toM <= at) continue;
    const start = Math.max(part.fromM, at);
    if (start > from)
      features.push(feature('path', sliceLine(line, from, start)));
    features.push(feature('hand', sliceLine(line, start, part.toM)));
    from = part.toM;
  }
  if (line.lengthM > from) {
    features.push(feature('path', sliceLine(line, from, line.lengthM)));
  }
  return { done, todo: { ...EMPTY, features } };
}

/** Where the rider is shown: on the track when placed, else at the GPS position. */
export function riderPoint(placement: Placement): LonLat | null {
  return placement.phase === 'onTrack' ? placement.snapped : placement.prev;
}

/** The point the rider is going to: the start, or the target off the track. */
export function targetPoint(
  line: TrackingLine,
  placement: Placement,
): LonLat | null {
  if (placement.phase === 'approach') return line.points[0] ?? null;
  if (placement.phase === 'offTrack' && placement.targetM !== null) {
    return pointAt(line, placement.targetM);
  }
  return null;
}

export type CameraPlan =
  | { kind: 'overview'; bounds: [number, number, number, number] }
  | {
      kind: 'bounds';
      bounds: [number, number, number, number];
      bearing: number;
    }
  | { kind: 'follow'; center: LonLat; bearing: number; zoom: number };

function boundsOf(points: LonLat[]): [number, number, number, number] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const [lon, lat] of points) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

/**
 * What the camera does after a position (mockup 30): the whole route while
 * waiting for the GPS; the rider and the target (start or nearest point)
 * when away from the track; else the rider on the track, in the direction
 * of the track, closer within 100 m of a direction.
 */
export function planCamera(
  line: TrackingLine,
  placement: Placement,
  imminent: boolean,
  northUp: boolean,
): CameraPlan {
  const rider = riderPoint(placement);
  if (placement.prev === null || !rider) {
    return { kind: 'overview', bounds: boundsOf(line.points) };
  }
  const bearing = northUp ? 0 : (cameraBearing(placement) ?? 0);
  const target = targetPoint(line, placement);
  if (target) {
    return { kind: 'bounds', bounds: boundsOf([rider, target]), bearing };
  }
  return {
    kind: 'follow',
    center: rider,
    bearing,
    zoom: imminent ? ZOOM_NEAR : ZOOM_ROAD,
  };
}

/** The dotted line from the rider to the start or to the nearest point. */
export function gapLine(
  line: TrackingLine,
  placement: Placement,
): LineCollection {
  const rider = riderPoint(placement);
  const target = targetPoint(line, placement);
  if (!rider || !target) return EMPTY;
  return { ...EMPTY, features: [feature('path', [rider, target])] };
}
