import { MIGRATIONS, migrate, type Migration } from './migrations';
import { createNodeSqlDb } from './testing/nodeSqlDb';
import { sampleCreated } from './testing/sampleRoutes';
import { insertRoute, getRoute } from './routeRepo';

const version = async (db: ReturnType<typeof createNodeSqlDb>) =>
  (await db.first<{ user_version: number }>('PRAGMA user_version'))!
    .user_version;
const tables = async (db: ReturnType<typeof createNodeSqlDb>) =>
  (
    await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
  ).map((r) => r.name);

const addColumn: Migration = (tx) =>
  tx.exec('ALTER TABLE routes ADD COLUMN note TEXT');

describe('migrate', () => {
  it('brings a new database from version 0 to version 1', async () => {
    const db = createNodeSqlDb();
    expect(await version(db)).toBe(0);

    expect(await migrate(db, MIGRATIONS)).toEqual({
      status: 'ready',
      version: 1,
    });

    expect(await version(db)).toBe(1);
    expect(await tables(db)).toEqual(['routes']);
  });

  it('creates a STRICT table: a wrong type is refused', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, zone_id, zone_version, zone_name, draft, legs, preview, distance_km, duration_s) VALUES ('a', 'created', 'not a number', 1, 'z', 1, 'Z', '{}', '[]', 'p', 1, 1)",
      ),
    ).rejects.toThrow();
  });

  it('refuses the rows the CHECK rules forbid', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    // GPX without track
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s) VALUES ('a', 'gpx', 1, 1, 'p', 1, 1)",
      ),
    ).rejects.toThrow();
    // created route without zone
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s, draft, legs) VALUES ('a', 'created', 1, 1, 'p', 1, 1, '{}', '[]')",
      ),
    ).rejects.toThrow();
    // unknown origin
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s, track) VALUES ('a', 'x', 1, 1, 'p', 1, 1, 't')",
      ),
    ).rejects.toThrow();
    // zone id without version and name
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s, track, zone_id) VALUES ('a', 'gpx', 1, 1, 'p', 1, 1, 't', 'z')",
      ),
    ).rejects.toThrow();
    // GPX with a draft
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s, track, draft) VALUES ('a', 'gpx', 1, 1, 'p', 1, 1, 't', '{}')",
      ),
    ).rejects.toThrow();
  });

  it('does nothing when opened a second time', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(db, sampleCreated());
    const before = await getRoute(db, id);

    expect(await migrate(db, MIGRATIONS)).toEqual({
      status: 'ready',
      version: 1,
    });

    expect(await version(db)).toBe(1);
    expect(await getRoute(db, id)).toEqual(before);
  });

  it('climbs from version 1 to a (test) version 2 and keeps the rows', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(db, sampleCreated());
    const before = await getRoute(db, id);

    expect(await migrate(db, [...MIGRATIONS, addColumn])).toEqual({
      status: 'ready',
      version: 2,
    });

    expect(await version(db)).toBe(2);
    expect(await getRoute(db, id)).toEqual(before);
    const columns = await db.all<{ name: string }>(
      "SELECT name FROM pragma_table_info('routes')",
    );
    expect(columns.map((c) => c.name)).toContain('note');
  });

  it('climbs from 0 to 2 in one call, one migration at a time', async () => {
    const db = createNodeSqlDb();
    expect(await migrate(db, [...MIGRATIONS, addColumn])).toEqual({
      status: 'ready',
      version: 2,
    });
    expect(await version(db)).toBe(2);
  });

  it('cancels a failing migration: version and tables stay as before', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(db, sampleCreated());
    const failing: Migration = async (tx) => {
      await tx.exec('ALTER TABLE routes ADD COLUMN note TEXT');
      await tx.exec('CREATE TABLE other (a INTEGER)');
      await tx.exec('DELETE FROM routes');
      throw new Error('broken migration');
    };

    await expect(migrate(db, [...MIGRATIONS, failing])).rejects.toThrow(
      'broken migration',
    );

    expect(await version(db)).toBe(1);
    expect(await tables(db)).toEqual(['routes']);
    const columns = await db.all<{ name: string }>(
      "SELECT name FROM pragma_table_info('routes')",
    );
    expect(columns.map((c) => c.name)).not.toContain('note');
    expect(await getRoute(db, id)).not.toBeNull();
  });

  it('keeps the versions already reached when a later one fails', async () => {
    const db = createNodeSqlDb();
    const failing: Migration = async () => {
      throw new Error('boom');
    };
    await expect(
      migrate(db, [...MIGRATIONS, addColumn, failing]),
    ).rejects.toThrow('boom');
    expect(await version(db)).toBe(2);
  });

  it('declares a database newer than the app "tooNew" and writes nothing', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(db, sampleCreated());
    await db.exec('PRAGMA user_version = 99');
    await db.exec('CREATE TABLE future (a INTEGER)');

    expect(await migrate(db, MIGRATIONS)).toEqual({
      status: 'tooNew',
      version: 99,
    });

    expect(await version(db)).toBe(99);
    expect(await tables(db)).toEqual(['future', 'routes']);
    expect(await getRoute(db, id)).not.toBeNull();
  });
});
