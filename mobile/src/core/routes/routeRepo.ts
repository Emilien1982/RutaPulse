// Reading and writing saved routes (ADR 0019, sections 1, 4 and 13).
// Every function takes the database: they run on any SqlDb.

import {
  checkName,
  defaultRouteName,
  RouteNameError,
  uniqueDefaultName,
} from './routeName';
import {
  draftToJson,
  legsToJson,
  rowToRoute,
  rowToSummary,
  routeToRow,
  type CreatedRoute,
  type NewRoute,
  type RouteListRow,
  type RouteRow,
  type RouteSummary,
  type SavedRoute,
} from './savedRoute';
import type { SqlDb } from './sqlDb';

// ascent_m and descent_m are INTEGER columns (STRICT): whole metres.
const roundOrNull = (m: number | null) => (m === null ? null : Math.round(m));

const LIST_COLUMNS =
  'id, name, origin, created_at, saved_at, zone_id, zone_name, preview, distance_km, duration_s, ascent_m, descent_m, figures_at';

/** Light columns only, last saved or imported first. */
export async function listRoutes(db: SqlDb): Promise<RouteSummary[]> {
  const rows = await db.all<RouteListRow>(
    `SELECT ${LIST_COLUMNS} FROM routes ORDER BY saved_at DESC, id DESC`,
  );
  return rows.map(rowToSummary);
}

/** null if there is no such route. Never throws on a wrong row. */
export async function getRoute(
  db: SqlDb,
  id: number,
): Promise<SavedRoute | null> {
  const row = await db.first<RouteRow>('SELECT * FROM routes WHERE id = ?', [
    id,
  ]);
  return row ? rowToRoute(row) : null;
}

/**
 * Default name of a route saved now: unique among the existing names. `base`
 * replaces "Itinéraire du 9 nov." (the name of a circuit).
 */
export async function newDefaultName(
  db: SqlDb,
  now: Date,
  base?: string,
): Promise<string> {
  const rows = await db.all<{ name: string }>('SELECT name FROM routes');
  return uniqueDefaultName(
    base ?? defaultRouteName(now),
    rows.map((r) => r.name),
  );
}

/** Returns the new id. The name must be valid (`RouteNameError` otherwise). */
export async function insertRoute(db: SqlDb, route: NewRoute): Promise<number> {
  const check = checkName(route.name);
  if (!check.ok) throw new RouteNameError(check.reason);
  const row = routeToRow({ ...route, name: check.name });
  const columns = Object.keys(row);
  const result = await db.run(
    `INSERT INTO routes (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    columns.map((c) => row[c]),
  );
  return result.lastInsertRowId;
}

/** What "Enregistrer" rewrites on a reopened route. Name and creation date stay. */
export type ReplaceInput = Pick<
  CreatedRoute,
  | 'draft'
  | 'legs'
  | 'zone'
  | 'preview'
  | 'distanceKm'
  | 'durationS'
  | 'ascentM'
  | 'descentM'
  | 'figuresAt'
  | 'savedAt'
>;

/** Replaces a created, trail or edited-GPX route. False if there is none. */
export async function replaceRoute(
  db: SqlDb,
  id: number,
  input: ReplaceInput,
): Promise<boolean> {
  const result = await db.run(
    `UPDATE routes SET draft = ?, legs = ?, zone_id = ?, zone_version = ?, zone_name = ?,
       preview = ?, distance_km = ?, duration_s = ?, ascent_m = ?, descent_m = ?,
       figures_at = ?, saved_at = ?
     WHERE id = ? AND origin IN ('created', 'trail', 'editedGpx')`,
    [
      draftToJson(input.draft),
      legsToJson(input.legs),
      input.zone.id,
      input.zone.version,
      input.zone.name,
      input.preview,
      input.distanceKm,
      input.durationS,
      roundOrNull(input.ascentM),
      roundOrNull(input.descentM),
      input.figuresAt,
      input.savedAt,
      id,
    ],
  );
  return result.changes > 0;
}

/** Does not change `saved_at`: the order of the list stays. */
export async function renameRoute(
  db: SqlDb,
  id: number,
  rawName: string,
): Promise<boolean> {
  const check = checkName(rawName);
  if (!check.ok) throw new RouteNameError(check.reason);
  const result = await db.run('UPDATE routes SET name = ? WHERE id = ?', [
    check.name,
    id,
  ]);
  return result.changes > 0;
}

export async function deleteRoute(db: SqlDb, id: number): Promise<boolean> {
  const result = await db.run('DELETE FROM routes WHERE id = ?', [id]);
  return result.changes > 0;
}

/** Writes ascent and descent and their date. `saved_at` stays. */
export async function updateFigures(
  db: SqlDb,
  id: number,
  ascentM: number | null,
  descentM: number | null,
  now: number,
): Promise<boolean> {
  const result = await db.run(
    'UPDATE routes SET ascent_m = ?, descent_m = ?, figures_at = ? WHERE id = ?',
    [roundOrNull(ascentM), roundOrNull(descentM), now, id],
  );
  return result.changes > 0;
}

export async function countRoutesByZone(
  db: SqlDb,
  zoneId: string,
): Promise<number> {
  const row = await db.first<{ n: number }>(
    'SELECT COUNT(*) AS n FROM routes WHERE zone_id = ?',
    [zoneId],
  );
  return row?.n ?? 0;
}

/** Gives a zone to a GPX route that has none. False if it already had one. */
export async function attachZone(
  db: SqlDb,
  id: number,
  zone: { id: string; version: number; name: string },
): Promise<boolean> {
  const result = await db.run(
    `UPDATE routes SET zone_id = ?, zone_version = ?, zone_name = ?
     WHERE id = ? AND origin = 'gpx' AND zone_id IS NULL`,
    [zone.id, zone.version, zone.name, id],
  );
  return result.changes > 0;
}

/**
 * Replaces an imported GPX by the route made from it (ADR 0020, section 7).
 * One `UPDATE`: the track now lives in the legs, so `track` and `elevations`
 * go. Name and creation date stay. False if there is no such GPX.
 */
export async function replaceGpx(
  db: SqlDb,
  id: number,
  input: ReplaceInput,
): Promise<boolean> {
  const result = await db.run(
    `UPDATE routes SET origin = 'editedGpx', draft = ?, legs = ?, track = NULL,
       elevations = NULL, zone_id = ?, zone_version = ?, zone_name = ?,
       preview = ?, distance_km = ?, duration_s = ?, ascent_m = ?, descent_m = ?,
       figures_at = ?, saved_at = ?
     WHERE id = ? AND origin = 'gpx'`,
    [
      draftToJson(input.draft),
      legsToJson(input.legs),
      input.zone.id,
      input.zone.version,
      input.zone.name,
      input.preview,
      input.distanceKm,
      input.durationS,
      roundOrNull(input.ascentM),
      roundOrNull(input.descentM),
      input.figuresAt,
      input.savedAt,
      id,
    ],
  );
  return result.changes > 0;
}
