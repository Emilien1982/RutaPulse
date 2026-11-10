// A saved route, as the app sees it, and its conversion from and to a row of
// the `routes` table (ADR 0019, section 1). Reading never throws: a wrong row
// gives an "unreadable" route that stays in the list.

import type { Draft, LegMode } from '@/core/draft/draft';
import { decodePolyline6, encodePolyline6 } from '@/core/routing/routeResponse';

import type { SqlValue } from './sqlDb';

export type RouteOrigin = 'created' | 'gpx' | 'trail' | 'editedGpx';

/** [lon, lat] */
export type LonLat = [number, number];

export type RouteZone = { id: string; version: number; name: string };

/** One leg of a created route. A "hand" leg is redrawn from the points. */
export type SavedLeg =
  | {
      mode: 'path';
      /** Version of the zone that calculated the shape. */
      zoneVersion: number;
      distanceKm: number;
      durationS: number;
      shape: LonLat[];
      /** The shape comes from a trace, not from the engine (ADR 0020, 4). */
      trace?: true;
    }
  | { mode: 'hand' };

type Common = {
  id: number;
  name: string;
  /** ms since 1970 (UTC): creation or import. */
  createdAt: number;
  /** ms: last "Enregistrer" or import. Sorts the list. */
  savedAt: number;
  zone: RouteZone | null;
  /** Encoded polyline (6 decimals), 66 points at most. */
  preview: string;
  distanceKm: number;
  durationS: number;
  /** null: never known. */
  ascentM: number | null;
  descentM: number | null;
  /** ms of the last calculation of ascent and descent. */
  figuresAt: number | null;
};

export type CreatedRoute = Common & {
  origin: 'created' | 'trail' | 'editedGpx';
  readable: true;
  zone: RouteZone;
  draft: Draft;
  /** One per leg, in the order of `draft.modes`. */
  legs: SavedLeg[];
};

export type GpxRoute = Common & {
  origin: 'gpx';
  readable: true;
  track: LonLat[];
  /** One per point of `track`; null when no point of the file has one. */
  elevations: (number | null)[] | null;
};

export type UnreadableRoute = Common & {
  origin: RouteOrigin;
  readable: false;
};

export type SavedRoute = CreatedRoute | GpxRoute | UnreadableRoute;

/** What `insertRoute` needs: a route without its id. */
export type NewRoute =
  Omit<CreatedRoute, 'id' | 'readable'> | Omit<GpxRoute, 'id' | 'readable'>;

/** A line of the list: light columns only. */
export type RouteSummary = {
  id: number;
  name: string;
  origin: RouteOrigin;
  createdAt: number;
  savedAt: number;
  zoneId: string | null;
  zoneName: string | null;
  preview: string;
  distanceKm: number;
  durationS: number;
  ascentM: number | null;
  descentM: number | null;
  figuresAt: number | null;
};

/** A row of `routes`, columns as in the table. */
export type RouteRow = {
  id: number;
  name: string;
  origin: RouteOrigin;
  created_at: number;
  saved_at: number;
  zone_id: string | null;
  zone_version: number | null;
  zone_name: string | null;
  draft: string | null;
  legs: string | null;
  track: string | null;
  elevations: string | null;
  preview: string;
  distance_km: number;
  duration_s: number;
  ascent_m: number | null;
  descent_m: number | null;
  figures_at: number | null;
};

export type RouteListRow = Pick<
  RouteRow,
  | 'id'
  | 'name'
  | 'origin'
  | 'created_at'
  | 'saved_at'
  | 'zone_id'
  | 'zone_name'
  | 'preview'
  | 'distance_km'
  | 'duration_s'
  | 'ascent_m'
  | 'descent_m'
  | 'figures_at'
>;

export function rowToSummary(row: RouteListRow): RouteSummary {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin,
    createdAt: row.created_at,
    savedAt: row.saved_at,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    preview: row.preview,
    distanceKm: row.distance_km,
    durationS: row.duration_s,
    ascentM: row.ascent_m,
    descentM: row.descent_m,
    figuresAt: row.figures_at,
  };
}

// --- Writing ---

export function draftToJson(draft: Draft): string {
  return JSON.stringify({
    points: draft.points.map(({ id, lon, lat }) => ({ id, lon, lat })),
    modes: draft.modes,
    ...(draft.linked && draft.linked.length > 0
      ? { linked: draft.linked }
      : {}),
  });
}

export function legsToJson(legs: SavedLeg[]): string {
  return JSON.stringify(
    legs.map((leg) =>
      leg.mode === 'hand'
        ? { mode: 'hand' }
        : {
            mode: 'path',
            zoneVersion: leg.zoneVersion,
            distanceKm: leg.distanceKm,
            durationS: leg.durationS,
            shape: encodePolyline6(leg.shape),
            ...(leg.trace ? { trace: true } : {}),
          },
    ),
  );
}

/** The columns of a new row, without `id`. */
export function routeToRow(route: NewRoute): Record<string, SqlValue> {
  const created = route.origin !== 'gpx';
  return {
    name: route.name,
    origin: route.origin,
    created_at: route.createdAt,
    saved_at: route.savedAt,
    zone_id: route.zone?.id ?? null,
    zone_version: route.zone?.version ?? null,
    zone_name: route.zone?.name ?? null,
    draft: created ? draftToJson(route.draft) : null,
    legs: created ? legsToJson(route.legs) : null,
    track: created ? null : encodePolyline6(route.track),
    elevations:
      created || !route.elevations ? null : JSON.stringify(route.elevations),
    preview: route.preview,
    distance_km: route.distanceKm,
    duration_s: route.durationS,
    ascent_m: route.ascentM === null ? null : Math.round(route.ascentM),
    descent_m: route.descentM === null ? null : Math.round(route.descentM),
    figures_at: route.figuresAt,
  };
}

// --- Reading ---

function fail(): never {
  throw new Error('unreadable route row');
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isFinite_ = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;
const isLon = (v: unknown): v is number =>
  isFinite_(v) && v >= -180 && v <= 180;
const isLat = (v: unknown): v is number => isFinite_(v) && v >= -90 && v <= 90;

function parseJson(text: string | null): unknown {
  if (text === null) return fail();
  try {
    return JSON.parse(text);
  } catch {
    return fail();
  }
}

function parseDraft(text: string | null): Draft {
  const json = parseJson(text);
  if (!isObject(json)) return fail();
  const { points, modes, linked } = json;
  if (!Array.isArray(points) || !Array.isArray(modes)) return fail();
  if (points.length < 2 || modes.length !== points.length - 1) return fail();
  const ids = new Set<number>();
  const checkedPoints = points.map((p: unknown) => {
    if (!isObject(p)) return fail();
    const { id, lon, lat } = p;
    if (!isPositiveInt(id) || ids.has(id) || !isLon(lon) || !isLat(lat)) {
      return fail();
    }
    ids.add(id);
    return { id, lon, lat };
  });
  const checkedModes = modes.map((m: unknown): LegMode => {
    if (m !== 'path' && m !== 'hand') return fail();
    return m;
  });
  const draft: Draft = { points: checkedPoints, modes: checkedModes };
  if (linked !== undefined) {
    if (!Array.isArray(linked)) return fail();
    draft.linked = linked.map((id: unknown) => {
      if (!isPositiveInt(id) || !ids.has(id)) return fail();
      return id;
    });
  }
  return draft;
}

function decodeShape(encoded: unknown): LonLat[] {
  if (typeof encoded !== 'string') return fail();
  const shape = decodePolyline6(encoded);
  if (shape.length < 2) return fail();
  for (const [lon, lat] of shape) if (!isLon(lon) || !isLat(lat)) return fail();
  return shape;
}

function parseLegs(text: string | null, draft: Draft): SavedLeg[] {
  const json = parseJson(text);
  if (!Array.isArray(json) || json.length !== draft.modes.length) return fail();
  return json.map((leg: unknown, i): SavedLeg => {
    if (!isObject(leg) || leg.mode !== draft.modes[i]) return fail();
    if (leg.mode === 'hand') return { mode: 'hand' };
    const { zoneVersion, distanceKm, durationS } = leg;
    if (!isPositiveInt(zoneVersion)) return fail();
    if (!isFinite_(distanceKm) || distanceKm < 0) return fail();
    if (!isFinite_(durationS) || durationS < 0) return fail();
    if (leg.trace !== undefined && leg.trace !== true) return fail();
    return {
      mode: 'path',
      zoneVersion,
      distanceKm,
      durationS,
      shape: decodeShape(leg.shape),
      ...(leg.trace === true ? { trace: true as const } : {}),
    };
  });
}

function parseElevations(
  text: string | null,
  length: number,
): (number | null)[] | null {
  if (text === null) return null;
  const json = parseJson(text);
  if (!Array.isArray(json) || json.length !== length) return fail();
  return json.map((e: unknown) => {
    if (e === null) return null;
    return isFinite_(e) ? e : fail();
  });
}

function parseZone(row: RouteRow): RouteZone | null {
  if (row.zone_id === null) return null;
  if (row.zone_version === null || row.zone_name === null) return fail();
  return { id: row.zone_id, version: row.zone_version, name: row.zone_name };
}

/** Never throws: a wrong row gives a route with `readable: false`. */
export function rowToRoute(row: RouteRow): SavedRoute {
  const common: Common = {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    savedAt: row.saved_at,
    zone: null,
    preview: row.preview,
    distanceKm: row.distance_km,
    durationS: row.duration_s,
    ascentM: row.ascent_m,
    descentM: row.descent_m,
    figuresAt: row.figures_at,
  };
  try {
    const zone = parseZone(row);
    if (
      row.origin === 'created' ||
      row.origin === 'trail' ||
      row.origin === 'editedGpx'
    ) {
      if (zone === null) return fail();
      const draft = parseDraft(row.draft);
      const legs = parseLegs(row.legs, draft);
      return {
        ...common,
        origin: row.origin,
        readable: true,
        zone,
        draft,
        legs,
      };
    }
    if (row.origin === 'gpx') {
      const track = decodeShape(row.track);
      const elevations = parseElevations(row.elevations, track.length);
      return {
        ...common,
        zone,
        origin: 'gpx',
        readable: true,
        track,
        elevations,
      };
    }
    return fail();
  } catch {
    // Unreadable, or any other surprise: never a crash.
    let zone: RouteZone | null = null;
    try {
      zone = parseZone(row);
    } catch {
      // A wrong zone is left out.
    }
    return { ...common, zone, origin: row.origin, readable: false };
  }
}
