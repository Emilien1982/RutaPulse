// Version 2 of routes.db (ADR 0020, section 7), on a real SQLite.

import { MIGRATIONS, migrate, type Migration } from './migrations';
import { getRoute, insertRoute, replaceGpx } from './routeRepo';
import { rowToRoute, type RouteRow } from './savedRoute';
import { createNodeSqlDb, type NodeSqlDb } from './testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from './testing/sampleRoutes';

const V1 = MIGRATIONS.slice(0, 1);

const version = async (db: NodeSqlDb) =>
  (await db.first<{ user_version: number }>('PRAGMA user_version'))!
    .user_version;
const rows = (db: NodeSqlDb) =>
  db.all<RouteRow>('SELECT * FROM routes ORDER BY id');
const schema = (db: NodeSqlDb) =>
  db.all<{ type: string; name: string; sql: string }>(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
  );

const BASE =
  "INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s, zone_id, zone_version, zone_name, draft, legs, track) VALUES ('a', ?, 1, 1, 'p', 1, 1, ?, ?, ?, ?, ?, ?)";
const insertRaw = (
  db: NodeSqlDb,
  origin: string,
  { zone = true, draft = true, track = false } = {},
) =>
  db.run(BASE, [
    origin,
    zone ? 'z' : null,
    zone ? 1 : null,
    zone ? 'Z' : null,
    draft ? '{}' : null,
    draft ? '[]' : null,
    track ? 't' : null,
  ]);

/** A version 1 base: created route, GPX with altitudes, GPX without zone, and the last id deleted. */
async function version1() {
  const db = createNodeSqlDb();
  await migrate(db, V1);
  await insertRoute(db, sampleCreated());
  await insertRoute(
    db,
    sampleGpx({ zone: { id: 'nancy', version: 5, name: 'Nancy' } }),
  );
  await insertRoute(
    db,
    sampleGpx({ name: 'Sans zone', zone: null, elevations: null }),
  );
  const last = await insertRoute(db, sampleCreated({ name: 'Supprimé' }));
  await db.run('DELETE FROM routes WHERE id = ?', [last]);
  return { db, last };
}

describe('MIGRATIONS[1]', () => {
  it('climbs a version 1 base to version 2 and keeps every row', async () => {
    const { db } = await version1();
    const before = await rows(db);
    const routesBefore = before.map(rowToRoute);
    expect(before).toHaveLength(3);

    expect(await migrate(db, MIGRATIONS)).toEqual({
      status: 'ready',
      version: 2,
    });

    expect(await version(db)).toBe(2);
    const after = await rows(db);
    expect(after).toEqual(before);
    expect(after.map(rowToRoute)).toEqual(routesBefore);
    expect(after.map(rowToRoute).every((r) => r.readable)).toBe(true);
  });

  it('never gives again a number already given', async () => {
    const { db, last } = await version1();
    await migrate(db, MIGRATIONS);

    const id = await insertRoute(db, sampleCreated({ name: 'Nouveau' }));

    expect(id).toBeGreaterThan(last);
    expect(id).toBe(last + 1);
  });

  it('keeps the counter of an empty table too', async () => {
    const db = createNodeSqlDb();
    await migrate(db, V1);
    await migrate(db, MIGRATIONS);
    expect(await insertRoute(db, sampleCreated())).toBe(1);
  });

  it('stays STRICT in version 2: a wrong type is refused', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, zone_id, zone_version, zone_name, draft, legs, preview, distance_km, duration_s) VALUES ('a', 'trail', 'not a number', 1, 'z', 1, 'Z', '{}', '[]', 'p', 1, 1)",
      ),
    ).rejects.toThrow();
  });

  it('accepts trail and editedGpx with a draft and legs', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    await insertRaw(db, 'trail');
    await insertRaw(db, 'editedGpx');
    const id = await insertRoute(db, sampleCreated({ origin: 'trail' }));
    const route = await getRoute(db, id);
    expect(route).toMatchObject({ origin: 'trail', readable: true });
  });

  it('refuses the rows the new CHECK rules forbid', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    await expect(insertRaw(db, 'trail', { draft: false })).rejects.toThrow();
    await expect(insertRaw(db, 'trail', { track: true })).rejects.toThrow();
    await expect(insertRaw(db, 'editedGpx', { zone: false })).rejects.toThrow();
    await expect(insertRaw(db, 'unknown')).rejects.toThrow();
  });

  it('a new base has the same schema as a climbed one', async () => {
    const fresh = createNodeSqlDb();
    expect(await migrate(fresh, MIGRATIONS)).toEqual({
      status: 'ready',
      version: 2,
    });
    const { db: climbed } = await version1();
    await migrate(climbed, MIGRATIONS);

    const normalize = (s: { sql: string }[]) =>
      s.map((x) => x.sql.replace(/\s+/g, ' '));
    expect((await schema(fresh)).map((x) => x.name)).toEqual(['routes']);
    expect((await schema(climbed)).map((x) => x.name)).toEqual(['routes']);
    expect(normalize(await schema(climbed))).toEqual(
      normalize(await schema(fresh)),
    );
  });

  it('a failure in the middle leaves version 1, the table and the rows', async () => {
    const { db } = await version1();
    const before = await rows(db);
    const schemaBefore = await schema(db);
    const sequenceBefore = await db.all('SELECT * FROM sqlite_sequence');
    const broken: Migration = async (tx) => {
      await MIGRATIONS[1](tx);
      await tx.exec('SELECT * FROM table_that_does_not_exist');
    };
    // The same steps with a wrong order: the table is dropped before the copy.
    const wrongOrder: Migration = async (tx) => {
      await tx.exec('DROP TABLE routes');
      await MIGRATIONS[1](tx);
    };

    await expect(migrate(db, [...V1, broken])).rejects.toThrow();
    await expect(migrate(db, [...V1, wrongOrder])).rejects.toThrow();

    expect(await version(db)).toBe(1);
    expect(await rows(db)).toEqual(before);
    expect(await schema(db)).toEqual(schemaBefore);
    expect(await db.all('SELECT * FROM sqlite_sequence')).toEqual(
      sequenceBefore,
    );
  });

  it('does nothing when opened a second time', async () => {
    const { db } = await version1();
    await migrate(db, MIGRATIONS);
    const before = await rows(db);
    const schemaBefore = await schema(db);

    expect(await migrate(db, MIGRATIONS)).toEqual({
      status: 'ready',
      version: 2,
    });

    expect(await rows(db)).toEqual(before);
    expect(await schema(db)).toEqual(schemaBefore);
  });

  it('a version 99 base is too new and nothing is written', async () => {
    const { db } = await version1();
    await db.exec('PRAGMA user_version = 99');
    const before = await rows(db);
    const schemaBefore = await schema(db);

    expect(await migrate(db, MIGRATIONS)).toEqual({
      status: 'tooNew',
      version: 99,
    });

    expect(await version(db)).toBe(99);
    expect(await rows(db)).toEqual(before);
    expect(await schema(db)).toEqual(schemaBefore);
  });
});

describe('replaceGpx', () => {
  const input = () => {
    const c = sampleCreated({
      origin: 'editedGpx',
      savedAt: 9_000,
      ascentM: 12.4,
      descentM: 3,
      figuresAt: 9_000,
    });
    return {
      draft: c.draft,
      legs: c.legs,
      zone: c.zone,
      preview: 'new-preview',
      distanceKm: 7,
      durationS: 800,
      ascentM: c.ascentM,
      descentM: c.descentM,
      figuresAt: c.figuresAt,
      savedAt: c.savedAt,
    };
  };

  it('rewrites the same row: same id, name and creation date', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(
      db,
      sampleGpx({ zone: { id: 'nancy', version: 5, name: 'Nancy' } }),
    );
    const before = (await db.first<RouteRow>('SELECT * FROM routes'))!;

    expect(await replaceGpx(db, id, input())).toBe(true);

    const after = (await db.first<RouteRow>('SELECT * FROM routes'))!;
    expect(await db.all('SELECT id FROM routes')).toEqual([{ id }]);
    expect(after).toMatchObject({
      id,
      name: before.name,
      created_at: before.created_at,
      origin: 'editedGpx',
      track: null,
      elevations: null,
      saved_at: 9_000,
      preview: 'new-preview',
      distance_km: 7,
      ascent_m: 12,
      descent_m: 3,
    });
    expect(await getRoute(db, id)).toMatchObject({
      origin: 'editedGpx',
      readable: true,
      name: before.name,
      createdAt: before.created_at,
    });
  });

  it('touches nothing when the row is not a GPX', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(db, sampleCreated());
    const before = await rows(db);

    expect(await replaceGpx(db, id, input())).toBe(false);
    expect(await replaceGpx(db, id + 1, input())).toBe(false);

    expect(await rows(db)).toEqual(before);
  });
});
