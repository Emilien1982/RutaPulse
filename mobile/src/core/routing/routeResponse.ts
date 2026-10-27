// Reading of a Valhalla answer, and the errors of the engine (ADR 0015,
// section 5). Only the `code` is read, never the text of a message.

export type RouteErrorKind =
  'outOfZone' | 'noRoute' | 'engineUnavailable' | 'zoneUnreadable' | 'failed';

export type RouteSuccess = {
  ok: true;
  /** [lon, lat] points. */
  shape: [number, number][];
  distanceKm: number;
  durationS: number;
};

export type RouteFailure = { ok: false; error: RouteErrorKind };

export type RouteResult = RouteSuccess | RouteFailure;

export function failure(error: RouteErrorKind): RouteFailure {
  return { ok: false, error };
}

/** Valhalla polyline with 6 decimals, as [lon, lat] points. */
export function decodePolyline6(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const readValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result += (byte & 0x1f) * 2 ** shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  };
  while (index < encoded.length) {
    lat += readValue();
    lon += readValue();
    points.push([lon / 1e6, lat / 1e6]);
  }
  return points;
}

/** Error kind for a Valhalla refusal code. */
export function kindFromValhallaCode(code: number): RouteErrorKind {
  if (code === 171) return 'outOfZone';
  if (code === 442 || code === 441 || code === 170) return 'noRoute';
  return 'failed';
}

/** Error kind for a rejected promise of the native module. */
export function kindFromNativeError(error: unknown): RouteErrorKind {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'ERR_ENGINE_NOT_OPEN') return 'engineUnavailable';
  if (code === 'ERR_ZONE_UNREADABLE') return 'zoneUnreadable';
  return 'failed';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads the JSON text returned by `route`. Never throws. */
export function parseRouteResponse(text: string): RouteResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return failure('failed');
  }
  if (!isObject(value)) return failure('failed');
  const trip = value.trip;
  if (!isObject(trip)) {
    return failure(
      typeof value.code === 'number'
        ? kindFromValhallaCode(value.code)
        : 'failed',
    );
  }
  const summary = trip.summary;
  if (
    !isObject(summary) ||
    typeof summary.length !== 'number' ||
    typeof summary.time !== 'number' ||
    !Array.isArray(trip.legs)
  ) {
    return failure('failed');
  }
  const shape: [number, number][] = [];
  for (const leg of trip.legs) {
    if (!isObject(leg) || typeof leg.shape !== 'string') {
      return failure('failed');
    }
    const points = decodePolyline6(leg.shape);
    // A leg starts where the previous one ends: keep that point once.
    const previous = shape[shape.length - 1];
    const first = points[0];
    if (
      previous &&
      first &&
      previous[0] === first[0] &&
      previous[1] === first[1]
    ) {
      points.shift();
    }
    shape.push(...points);
  }
  if (shape.length < 2) return failure('failed');
  return {
    ok: true,
    shape,
    distanceKm: summary.length,
    durationS: summary.time,
  };
}
