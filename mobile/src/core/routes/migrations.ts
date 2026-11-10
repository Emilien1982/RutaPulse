// Schema of routes.db and its version number (ADR 0019, sections 1 and 2).

import type { SqlDb, SqlRunner } from './sqlDb';

/** Turns the database from version `i` to version `i + 1`. */
export type Migration = (tx: SqlRunner) => Promise<void>;

const CREATE_ROUTES = `CREATE TABLE routes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  origin       TEXT    NOT NULL CHECK (origin IN ('created', 'gpx')),
  created_at   INTEGER NOT NULL,
  saved_at     INTEGER NOT NULL,
  zone_id      TEXT,
  zone_version INTEGER,
  zone_name    TEXT,
  draft        TEXT,
  legs         TEXT,
  track        TEXT,
  elevations   TEXT,
  preview      TEXT    NOT NULL,
  distance_km  REAL    NOT NULL,
  duration_s   REAL    NOT NULL,
  ascent_m     INTEGER,
  descent_m    INTEGER,
  figures_at   INTEGER,
  CHECK ((origin = 'created' AND draft IS NOT NULL AND legs IS NOT NULL
          AND track IS NULL AND elevations IS NULL AND zone_id IS NOT NULL)
      OR (origin = 'gpx' AND track IS NOT NULL
          AND draft IS NULL AND legs IS NULL)),
  CHECK ((zone_id IS NULL) = (zone_version IS NULL)
     AND (zone_id IS NULL) = (zone_name IS NULL))
) STRICT`;

// Version 2 (ADR 0020, section 7): two more origins. SQLite cannot change a
// CHECK, so the table is rebuilt (method of the SQLite documentation).
const CREATE_ROUTES_V2 = CREATE_ROUTES.replace(
  'CREATE TABLE routes (',
  'CREATE TABLE routes_new (',
)
  .replace(
    "origin IN ('created', 'gpx')",
    "origin IN ('created', 'gpx', 'trail', 'editedGpx')",
  )
  .replace(
    "(origin = 'created' AND draft",
    "(origin IN ('created', 'trail', 'editedGpx') AND draft",
  );

const COLUMNS =
  'id, name, origin, created_at, saved_at, zone_id, zone_version, zone_name, draft, legs, track, elevations, preview, distance_km, duration_s, ascent_m, descent_m, figures_at';

async function addTrailOrigins(tx: SqlRunner): Promise<void> {
  await tx.exec(CREATE_ROUTES_V2);
  await tx.exec(
    `INSERT INTO routes_new (${COLUMNS}) SELECT ${COLUMNS} FROM routes`,
  );
  // The AUTOINCREMENT counter does not follow by itself (checked on
  // node:sqlite, ADR 0020 check 2): copy it before the DROP.
  await tx.exec("DELETE FROM sqlite_sequence WHERE name = 'routes_new'");
  await tx.exec(
    "INSERT INTO sqlite_sequence (name, seq) SELECT 'routes_new', seq FROM sqlite_sequence WHERE name = 'routes'",
  );
  await tx.exec('DROP TABLE routes');
  await tx.exec('ALTER TABLE routes_new RENAME TO routes');
}

/** Never change a delivered migration: add a new one at the end. */
export const MIGRATIONS: readonly Migration[] = [
  (tx) => tx.exec(CREATE_ROUTES),
  addTrailOrigins,
];

/** The database was written by a newer app: nothing may be written. */
export class RoutesTooNewError extends Error {
  constructor() {
    super('routes.db was written by a newer version of the app');
  }
}

export type MigrateResult = { status: 'ready' | 'tooNew'; version: number };

async function readVersion(db: SqlDb): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Brings the database to the last version, one migration per exclusive
 * transaction. A failure rolls back the failed migration and is thrown.
 * A database newer than the app is left untouched.
 */
export async function migrate(
  db: SqlDb,
  migrations: readonly Migration[],
): Promise<MigrateResult> {
  let version = await readVersion(db);
  if (version > migrations.length) return { status: 'tooNew', version };
  while (version < migrations.length) {
    const from = version;
    await db.transaction(async (tx) => {
      await migrations[from](tx);
      await tx.exec(`PRAGMA user_version = ${from + 1}`);
    });
    version = from + 1;
  }
  return { status: 'ready', version };
}
