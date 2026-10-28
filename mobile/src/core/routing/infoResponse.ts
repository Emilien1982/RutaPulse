// Reading of the `height` and `trace_attributes` answers (ADR 0017, section
// 1). Never throws. Any refusal or unreadable answer is 'failed': for the
// infos, only "present or missing" counts (ADR 0017, section 8).

import {
  failure,
  kindFromValhallaCode,
  type RouteFailure,
} from './routeResponse';

/** [distance along the shape in m, altitude in m or null]. */
export type ProfilePoint = [number, number | null];

export type TerrainEdge = {
  use: string;
  /** 0 when Valhalla gives none. */
  density: number;
  lengthKm: number;
};

export type HeightResult = { ok: true; profile: ProfilePoint[] } | RouteFailure;

export type TraceResult = { ok: true; edges: TerrainEdge[] } | RouteFailure;

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

function isProfilePoint(value: unknown): value is ProfilePoint {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    (typeof value[1] === 'number' || value[1] === null)
  );
}

/** Reads the JSON text returned by `height` with `range: true`. */
export function parseHeightResponse(text: string): HeightResult {
  const value = parseObject(text);
  if (!value) return failure('failed');
  const range = value.range_height;
  if (!Array.isArray(range)) return refusal(value);
  if (range.length === 0 || !range.every(isProfilePoint)) {
    return failure('failed');
  }
  return { ok: true, profile: range as ProfilePoint[] };
}

/** Reads the JSON text returned by `trace_attributes`. */
export function parseTraceResponse(text: string): TraceResult {
  const value = parseObject(text);
  if (!value) return failure('failed');
  const raw = value.edges;
  if (!Array.isArray(raw)) return refusal(value);
  const edges: TerrainEdge[] = [];
  for (const edge of raw) {
    if (!isObject(edge) || typeof edge.length !== 'number') {
      return failure('failed');
    }
    edges.push({
      use: typeof edge.use === 'string' ? edge.use : '',
      density: typeof edge.density === 'number' ? edge.density : 0,
      lengthKm: edge.length,
    });
  }
  return { ok: true, edges };
}
