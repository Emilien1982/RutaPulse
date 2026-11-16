// What the tracking draws and where the camera looks (ADR 0021, section 3).
// Pure logic: the components only hand it to MapLibre.

import { cameraBearing, type Placement } from '@/core/tracking/placement';
import {
  buildLine,
  distanceM,
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

/** Distance on the ground (m) of one point of the screen at this zoom and latitude. */
export function metersPerPoint(zoom: number, latitude: number): number {
  // MapLibre: tiles of 512 points.
  return (78271.517 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * The zoom `fitBounds` ends on: the box [west, south, east, north], turned
 * by the bearing, fits in the screen minus the padding. Known before the
 * camera finishes, unlike the zoom read from the map events.
 */
export function boundsZoom(
  bounds: [number, number, number, number],
  bearing: number,
  size: { width: number; height: number },
  padding: { top: number; bottom: number; left: number; right: number },
): number {
  // Web Mercator at zoom 0 (a world of 512 points).
  const x = (lon: number) => ((lon + 180) / 360) * 512;
  const y = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return (
      (0.5 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / (2 * Math.PI)) * 512
    );
  };
  const [west, south, east, north] = bounds;
  const a = (-bearing * Math.PI) / 180;
  const turned = [
    [west, south],
    [west, north],
    [east, south],
    [east, north],
  ].map(([lon, lat]) => {
    const px = x(lon as number);
    const py = y(lat as number);
    return [
      px * Math.cos(a) - py * Math.sin(a),
      px * Math.sin(a) + py * Math.cos(a),
    ] as const;
  });
  const xs = turned.map((c) => c[0]);
  const ys = turned.map((c) => c[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const room = {
    w: size.width - padding.left - padding.right,
    h: size.height - padding.top - padding.bottom,
  };
  const zoom = Math.min(Math.log2(room.w / w), Math.log2(room.h / h));
  return Number.isFinite(zoom) ? Math.min(Math.max(zoom, 0), 22) : 22;
}

/** Most dots of the gap line (a safety: a very long gap). */
export const MAX_GAP_DOTS = 300;

/**
 * The dots of the gap line: one every `spacingM` meters from the rider to the
 * target, round on both platforms (a dash of length zero draws an oval on
 * iOS). The end points are left out: the rider and the target are drawn there.
 */
export function gapDots(
  from: LonLat,
  to: LonLat,
  spacingM: number,
): { type: 'FeatureCollection'; features: PointFeature[] } {
  const total = distanceM(from, to);
  const features: PointFeature[] = [];
  if (spacingM > 0) {
    for (
      let d = spacingM;
      d < total && features.length < MAX_GAP_DOTS;
      d += spacingM
    ) {
      const f = d / total;
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [
            from[0] + (to[0] - from[0]) * f,
            from[1] + (to[1] - from[1]) * f,
          ],
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

type PointFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'Point'; coordinates: LonLat };
};
