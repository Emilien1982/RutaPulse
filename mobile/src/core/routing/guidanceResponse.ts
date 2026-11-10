// Reading of the `trace_route` and `trace_attributes` (map_snap) answers for
// the tracking (ADR 0021, section 1). Never throws. Any refusal or unreadable
// answer is 'failed': for the directions, only "present or not" counts.

import {
  decodePolyline6,
  failure,
  kindFromValhallaCode,
  type RouteFailure,
} from './routeResponse';

/** A maneuver of the engine, with the indices in the matched shape. */
export type Maneuver = {
  /** Valhalla maneuver type (1 start, 10 right, 15 left, 26 roundabout...). */
  type: number;
  beginShapeIndex: number;
  /** Only for a roundabout entry. */
  exitCount?: number;
};

export type TraceRouteResult =
  { ok: true; shape: [number, number][]; maneuvers: Maneuver[] } | RouteFailure;

/** A way under the matched shape. */
export type MatchedEdge = {
  use: string;
  /** 0 when Valhalla gives none. */
  density: number;
  beginShapeIndex: number;
};

export type MatchedEdgesResult =
  { ok: true; shape: [number, number][]; edges: MatchedEdge[] } | RouteFailure;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function refusal(value: Record<string, unknown>): RouteFailure {
  return failure(
    typeof value.code === 'number'
      ? kindFromValhallaCode(value.code)
      : 'failed',
  );
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Reads the JSON text returned by `trace_route`. The legs are put end to
 * end: the indices of a leg are shifted by the points before it.
 */
export function parseTraceRouteResponse(text: string): TraceRouteResult {
  const value = parseObject(text);
  if (!value) return failure('failed');
  const trip = value.trip;
  if (!isObject(trip) || !Array.isArray(trip.legs)) return refusal(value);
  const shape: [number, number][] = [];
  const maneuvers: Maneuver[] = [];
  for (const leg of trip.legs as unknown[]) {
    if (!isObject(leg) || typeof leg.shape !== 'string') {
      return failure('failed');
    }
    if (!Array.isArray(leg.maneuvers)) return failure('failed');
    const points = decodePolyline6(leg.shape);
    // The first point of a leg is the last of the one before.
    const offset = shape.length > 0 ? shape.length - 1 : 0;
    for (const raw of leg.maneuvers as unknown[]) {
      if (
        !isObject(raw) ||
        typeof raw.type !== 'number' ||
        !isIndex(raw.begin_shape_index)
      ) {
        return failure('failed');
      }
      const exit = raw.roundabout_exit_count;
      maneuvers.push({
        type: raw.type,
        beginShapeIndex: offset + raw.begin_shape_index,
        ...(typeof exit === 'number' ? { exitCount: exit } : {}),
      });
    }
    shape.push(...(shape.length > 0 ? points.slice(1) : points));
  }
  if (shape.length < 2) return failure('failed');
  return { ok: true, shape, maneuvers };
}

/** Reads the JSON text returned by `trace_attributes` with `map_snap`. */
export function parseMatchedEdges(text: string): MatchedEdgesResult {
  const value = parseObject(text);
  if (!value) return failure('failed');
  if (!Array.isArray(value.edges) || typeof value.shape !== 'string') {
    return refusal(value);
  }
  const edges: MatchedEdge[] = [];
  for (const raw of value.edges as unknown[]) {
    if (!isObject(raw) || !isIndex(raw.begin_shape_index)) {
      return failure('failed');
    }
    edges.push({
      use: typeof raw.use === 'string' ? raw.use : '',
      density: typeof raw.density === 'number' ? raw.density : 0,
      beginShapeIndex: raw.begin_shape_index,
    });
  }
  const shape = decodePolyline6(value.shape);
  if (shape.length < 2) return failure('failed');
  return { ok: true, shape, edges };
}
