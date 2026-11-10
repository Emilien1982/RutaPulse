// Tests written by the tester from the spec (docs/phases/p06-..., C2, C3, C4,
// C5, C8) and ADR 0019 (sections 1, 2, 4, 11, answers 1 and 2), not from the
// code. Real SQLite (node:sqlite); C3 uses real files on disk, kept in
// PREUVES_DIR (default: a folder in the temporary directory of the machine,
// because the CI has no /Users folder).

import { MIGRATIONS, migrate, type Migration } from '../migrations';
import {
  countRoutesByZone,
  deleteRoute,
  getRoute,
  insertRoute,
  listRoutes,
  newDefaultName,
  renameRoute,
  replaceRoute,
  updateFigures,
} from '../routeRepo';
import { checkName, defaultRouteName, RouteNameError } from '../routeName';
import type { CreatedRoute, GpxRoute, LonLat } from '../savedRoute';
import { createNodeSqlDb } from '../testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '../testing/sampleRoutes';

// Version 1 of the schema: these tests describe the first migration.
const V1 = MIGRATIONS.slice(0, 1);

declare const process: { env: Record<string, string | undefined> };
declare function require(name: string): unknown;
type Fs = {
  rmSync(file: string, o: { force: boolean }): void;
  mkdirSync(dir: string, o: { recursive: boolean }): void;
  existsSync(file: string): boolean;
};
const fs = require('fs') as Fs;
const os = require('os') as { tmpdir(): string };
const DIR = process.env.PREUVES_DIR ?? `${os.tmpdir()}/rutapulse-t3-testeur-db`;

const fresh = async () => {
  const db = createNodeSqlDb();
  await migrate(db, V1);
  return db;
};
const version = async (db: { first: <T>(s: string) => Promise<T | null> }) =>
  (await db.first<{ user_version: number }>('PRAGMA user_version'))!
    .user_version;
const columns = async (db: { all: <T>(s: string) => Promise<T[]> }) =>
  (await db.all<{ name: string }>('PRAGMA table_info(routes)')).map(
    (c) => c.name,
  );

function expectShape(a: LonLat[], b: LonLat[]) {
  expect(a).toHaveLength(b.length);
  a.forEach(([lon, lat], i) => {
    expect(Math.abs(lon - b[i][0])).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(lat - b[i][1])).toBeLessThanOrEqual(1e-6);
  });
}

describe('C2 - version of the schema', () => {
  it('empty base: 0 to 1, table created', async () => {
    const db = createNodeSqlDb();
    expect(await version(db)).toBe(0);
    const r = await migrate(db, V1);
    expect(r).toEqual({ status: 'ready', version: 1 });
    expect(await version(db)).toBe(1);
    expect((await columns(db)).length).toBeGreaterThan(10);
  });

  it('second opening changes nothing', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated());
    expect(await migrate(db, V1)).toEqual({
      status: 'ready',
      version: 1,
    });
    expect((await listRoutes(db)).map((r) => r.id)).toEqual([id]);
  });

  // The app never produces this state (table and version in one transaction),
  // and an unknown table may have another schema: refuse, write nothing.
  it('version 0 base with an unknown routes table: throws, stays in 0, row kept', async () => {
    const db = createNodeSqlDb();
    await db.exec(
      "CREATE TABLE routes (id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO routes VALUES (1, 'avant')",
    );
    await expect(migrate(db, V1)).rejects.toThrow();
    expect(await version(db)).toBe(0);
    const rows = await db.all<{ id: number; name: string }>(
      'SELECT * FROM routes',
    );
    expect(rows).toEqual([{ id: 1, name: 'avant' }]);
    expect(await columns(db)).toEqual(['id', 'name']);
  });

  it('real climb 1 to 2: a row written in v1 is intact in v2', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated());
    const before = await getRoute(db, id);
    const m2: Migration = (tx) =>
      tx.exec('ALTER TABLE routes ADD COLUMN note TEXT');
    const r = await migrate(db, [...V1, m2]);
    expect(r).toEqual({ status: 'ready', version: 2 });
    expect(await columns(db)).toContain('note');
    expect(await getRoute(db, id)).toEqual(before);
  });

  it('migration 2 failing in the middle: stays in version 1, intact', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated());
    const before = await getRoute(db, id);
    const cols = await columns(db);
    const bad: Migration = async (tx) => {
      await tx.exec('ALTER TABLE routes ADD COLUMN half TEXT');
      await tx.exec("UPDATE routes SET name = 'casse'");
      throw new Error('boom');
    };
    await expect(migrate(db, [...V1, bad])).rejects.toThrow('boom');
    expect(await version(db)).toBe(1);
    expect(await columns(db)).toEqual(cols);
    expect(await getRoute(db, id)).toEqual(before);
    // and the base still works afterwards
    await insertRoute(db, sampleGpx());
    expect(await listRoutes(db)).toHaveLength(2);
  });

  it('migration failing by SQL error (not a throw) also rolls back', async () => {
    const db = await fresh();
    const bad: Migration = async (tx) => {
      await tx.exec('ALTER TABLE routes ADD COLUMN ok TEXT');
      await tx.exec('ALTER TABLE nope ADD COLUMN x TEXT');
    };
    await expect(migrate(db, [...V1, bad])).rejects.toThrow();
    expect(await version(db)).toBe(1);
    expect(await columns(db)).not.toContain('ok');
  });

  it('base in version 99: too new, never written', async () => {
    const db = await fresh();
    await insertRoute(db, sampleCreated());
    await db.exec('PRAGMA user_version = 99');
    const schema = await db.all('SELECT * FROM sqlite_master');
    const rows = await db.all('SELECT * FROM routes');
    const r = await migrate(db, V1);
    expect(r.status).toBe('tooNew');
    expect(r.version).toBe(99);
    // even with more migrations than the app knows, 99 stays
    const extra: Migration = (tx) =>
      tx.exec('ALTER TABLE routes ADD COLUMN z TEXT');
    expect((await migrate(db, [...V1, extra])).status).toBe('tooNew');
    expect(await version(db)).toBe(99);
    expect(await db.all('SELECT * FROM sqlite_master')).toEqual(schema);
    expect(await db.all('SELECT * FROM routes')).toEqual(rows);
  });

  it('CHECK refuses wrong rows (gpx without track, created without zone)', async () => {
    const db = await fresh();
    await expect(
      db.run(
        "INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s) VALUES ('a','gpx',1,1,'x',1,1)",
      ),
    ).rejects.toThrow();
    await expect(
      insertRoute(db, { ...sampleCreated(), zone: null } as never),
    ).rejects.toThrow();
  });
});

describe('C3 - kept after closing and reopening the file', () => {
  const open = (file: string) => createNodeSqlDb(`${DIR}/${file}`);
  const reset = (file: string) => {
    fs.mkdirSync(DIR, { recursive: true });
    fs.rmSync(`${DIR}/${file}`, { force: true });
  };

  it('created route is identical', async () => {
    reset('created.db');
    const input = sampleCreated({
      name: 'Côte du Grand Ballon ⛰️',
      createdAt: 1_700_000_000_123,
      savedAt: 1_700_000_999_456,
      zone: { id: 'vosges-nord', version: 7, name: 'Vosges du Nord' },
      distanceKm: 12.3456,
      durationS: 5432.1,
      ascentM: 321,
      descentM: 298,
      figuresAt: 1_700_000_999_999,
      preview: '_p~iF~ps|U_ulLnnqC',
      legs: [
        {
          mode: 'path',
          zoneVersion: 7,
          distanceKm: 3.141,
          durationS: 777,
          shape: [
            [6.123456, 48.654321],
            [6.1234567, 48.6543219],
            [6.2, 48.7],
          ],
        },
        { mode: 'hand' },
      ],
    });
    const a = open('created.db');
    await migrate(a, V1);
    const id = await insertRoute(a, input);
    a.close();

    const b = open('created.db');
    expect(await migrate(b, V1)).toEqual({
      status: 'ready',
      version: 1,
    });
    const r = (await getRoute(b, id)) as CreatedRoute;
    expect(r.readable).toBe(true);
    expect(r.origin).toBe('created');
    expect(r.name).toBe(input.name);
    expect(r.draft).toEqual(input.draft);
    expect(r.zone).toEqual(input.zone);
    expect(r.createdAt).toBe(input.createdAt);
    expect(r.savedAt).toBe(input.savedAt);
    expect(r.distanceKm).toBe(input.distanceKm);
    expect(r.durationS).toBe(input.durationS);
    expect(r.ascentM).toBe(321);
    expect(r.descentM).toBe(298);
    expect(r.figuresAt).toBe(input.figuresAt);
    expect(r.preview).toBe(input.preview);
    expect(r.legs.map((l) => l.mode)).toEqual(['path', 'hand']);
    const leg = r.legs[0] as Extract<CreatedRoute['legs'][0], { mode: 'path' }>;
    expect(leg.zoneVersion).toBe(7);
    expect(leg.distanceKm).toBe(3.141);
    expect(leg.durationS).toBe(777);
    expectShape(leg.shape, [
      [6.123456, 48.654321],
      [6.1234567, 48.6543219],
      [6.2, 48.7],
    ]);
    b.close();
    expect(fs.existsSync(`${DIR}/created.db`)).toBe(true);
  });

  it('gpx route is identical (track and elevations)', async () => {
    reset('gpx.db');
    const track: LonLat[] = [
      [6.1812349, 48.6912341],
      [-1.5, -33.25],
      [179.999999, 85.000001],
      [6.2, 48.7],
    ];
    const input = sampleGpx({
      name: 'Import déjà là',
      track,
      elevations: [212.3, null, -12.5, 1500],
      zone: null,
      ascentM: null,
      descentM: null,
      figuresAt: null,
    });
    const a = open('gpx.db');
    await migrate(a, V1);
    const id = await insertRoute(a, input);
    a.close();
    const b = open('gpx.db');
    await migrate(b, V1);
    const r = (await getRoute(b, id)) as GpxRoute;
    expect(r.origin).toBe('gpx');
    expect(r.readable).toBe(true);
    expect(r.name).toBe(input.name);
    expect(r.zone).toBeNull();
    expectShape(r.track, track);
    expect(r.elevations).toEqual([212.3, null, -12.5, 1500]);
    expect(r.ascentM).toBeNull();
    expect(r.figuresAt).toBeNull();
    expect(r.createdAt).toBe(input.createdAt);
    b.close();
  });

  it('gpx without any altitude keeps elevations null', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleGpx({ elevations: null }));
    expect(((await getRoute(db, id)) as GpxRoute).elevations).toBeNull();
  });

  it('gpx route with a zone keeps zone and version', async () => {
    const db = await fresh();
    const zone = { id: 'nancy', version: 5, name: 'Nancy' };
    const id = await insertRoute(db, sampleGpx({ zone }));
    expect((await getRoute(db, id))!.zone).toEqual(zone);
  });

  it('missing id gives null', async () => {
    const db = await fresh();
    expect(await getRoute(db, 999)).toBeNull();
  });
});

describe('C4 - name', () => {
  const day = new Date(2026, 10, 3, 14, 30); // 3 Nov 2026, local
  const base = 'Itinéraire du 3 nov.';

  it('default name is the date alone', () => {
    expect(defaultRouteName(day)).toBe(base);
    expect(defaultRouteName(new Date(2026, 0, 1))).toBe(
      'Itinéraire du 1 janv.',
    );
    expect(defaultRouteName(new Date(2026, 11, 31))).toBe(
      'Itinéraire du 31 déc.',
    );
  });

  const save = async (db: Awaited<ReturnType<typeof fresh>>, now = day) =>
    insertRoute(db, sampleCreated({ name: await newDefaultName(db, now) }));
  const names = async (db: Awaited<ReturnType<typeof fresh>>) =>
    (await listRoutes(db)).map((r) => r.name).sort();

  it('same day: base, (2), (3)', async () => {
    const db = await fresh();
    await save(db);
    await save(db);
    await save(db);
    expect(await names(db)).toEqual([base, `${base} (2)`, `${base} (3)`]);
  });

  it('a default name of another day does not count', async () => {
    const db = await fresh();
    await insertRoute(db, sampleCreated({ name: 'Itinéraire du 2 nov.' }));
    await insertRoute(db, sampleCreated({ name: 'Itinéraire du 2 nov. (2)' }));
    expect(await newDefaultName(db, day)).toBe(base);
  });

  it('a gap in the sequence is reused: (3) exists, (2) deleted', async () => {
    const db = await fresh();
    await insertRoute(db, sampleCreated({ name: base }));
    await insertRoute(db, sampleCreated({ name: `${base} (3)` }));
    expect(await newDefaultName(db, day)).toBe(`${base} (2)`);
    await insertRoute(db, sampleCreated({ name: `${base} (2)` }));
    expect(await newDefaultName(db, day)).toBe(`${base} (4)`);
  });

  it('base deleted, (2) kept: base is free again', async () => {
    const db = await fresh();
    await insertRoute(db, sampleCreated({ name: `${base} (2)` }));
    expect(await newDefaultName(db, day)).toBe(base);
  });

  it('a route renamed to the default name counts', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated({ name: 'Autre' }));
    await renameRoute(db, id, base);
    expect(await newDefaultName(db, day)).toBe(`${base} (2)`);
  });

  it('rename: empty or spaces-only refused, row unchanged', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated({ name: 'Garde' }));
    for (const bad of ['', '   ', '\n\t ', '\u0000\u0007']) {
      await expect(renameRoute(db, id, bad)).rejects.toBeInstanceOf(
        RouteNameError,
      );
    }
    expect((await getRoute(db, id))!.name).toBe('Garde');
  });

  it('60 characters accepted, 61 refused', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated());
    await renameRoute(db, id, 'a'.repeat(60));
    expect((await getRoute(db, id))!.name).toBe('a'.repeat(60));
    await expect(renameRoute(db, id, 'a'.repeat(61))).rejects.toMatchObject({
      reason: 'tooLong',
    });
    expect((await getRoute(db, id))!.name).toBe('a'.repeat(60));
  });

  it('emoji count as one character; accents kept', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated());
    const sixty = '🚵'.repeat(60);
    await renameRoute(db, id, sixty);
    expect((await getRoute(db, id))!.name).toBe(sixty);
    await expect(renameRoute(db, id, '🚵'.repeat(61))).rejects.toBeInstanceOf(
      RouteNameError,
    );
    await renameRoute(db, id, 'Été à Gérardmer, très élevé ç œ');
    expect((await getRoute(db, id))!.name).toBe(
      'Été à Gérardmer, très élevé ç œ',
    );
  });

  it('spaces around are trimmed and not counted; inner runs collapsed', () => {
    expect(checkName(`  ${'a'.repeat(60)}  `)).toEqual({
      ok: true,
      name: 'a'.repeat(60),
    });
    expect(checkName('a   b\n\nc')).toEqual({ ok: true, name: 'a b c' });
  });

  it('insert also refuses an invalid name', async () => {
    const db = await fresh();
    await expect(
      insertRoute(db, sampleCreated({ name: '  ' })),
    ).rejects.toThrow();
    expect(await listRoutes(db)).toHaveLength(0);
  });

  it('rename of an unknown id returns false', async () => {
    const db = await fresh();
    expect(await renameRoute(db, 42, 'x')).toBe(false);
  });
});

describe('C5 - order of the list', () => {
  it('most recent first', async () => {
    const db = await fresh();
    const a = await insertRoute(
      db,
      sampleCreated({ name: 'A', savedAt: 1000 }),
    );
    const b = await insertRoute(db, sampleGpx({ name: 'B', savedAt: 3000 }));
    const c = await insertRoute(
      db,
      sampleCreated({ name: 'C', savedAt: 2000 }),
    );
    expect((await listRoutes(db)).map((r) => r.id)).toEqual([b, c, a]);
  });

  it('replace makes the route go up; name and createdAt stay', async () => {
    const db = await fresh();
    const a = await insertRoute(
      db,
      sampleCreated({ name: 'A', createdAt: 1000, savedAt: 1000 }),
    );
    const b = await insertRoute(
      db,
      sampleCreated({ name: 'B', savedAt: 2000 }),
    );
    const s = sampleCreated({ savedAt: 5000, distanceKm: 9, durationS: 9 });
    expect(
      await replaceRoute(db, a, {
        draft: s.draft,
        legs: s.legs,
        zone: s.zone,
        preview: s.preview,
        distanceKm: 9,
        durationS: 9,
        ascentM: 10.4,
        descentM: 11.6,
        figuresAt: 5000,
        savedAt: 5000,
      }),
    ).toBe(true);
    const list = await listRoutes(db);
    expect(list.map((r) => r.id)).toEqual([a, b]);
    expect(list[0]).toMatchObject({
      name: 'A',
      createdAt: 1000,
      savedAt: 5000,
      distanceKm: 9,
      ascentM: 10,
      descentM: 12,
    });
  });

  it('replace on a gpx route or unknown id changes nothing', async () => {
    const db = await fresh();
    const g = await insertRoute(db, sampleGpx());
    const s = sampleCreated();
    const input = {
      draft: s.draft,
      legs: s.legs,
      zone: s.zone,
      preview: 'p',
      distanceKm: 1,
      durationS: 1,
      ascentM: null,
      descentM: null,
      figuresAt: null,
      savedAt: 9,
    };
    expect(await replaceRoute(db, g, input)).toBe(false);
    expect(await replaceRoute(db, 999, input)).toBe(false);
    expect(((await getRoute(db, g)) as GpxRoute).track.length).toBe(3);
  });

  it('rename and updateFigures do not change the order', async () => {
    const db = await fresh();
    const a = await insertRoute(
      db,
      sampleCreated({ name: 'A', savedAt: 1000 }),
    );
    const b = await insertRoute(
      db,
      sampleCreated({ name: 'B', savedAt: 2000 }),
    );
    await renameRoute(db, a, 'Z premier');
    await updateFigures(db, a, 100.4, 50.6, 9_999_999);
    const list = await listRoutes(db);
    expect(list.map((r) => r.id)).toEqual([b, a]);
    expect(list[1]).toMatchObject({
      savedAt: 1000,
      ascentM: 100,
      descentM: 51,
      figuresAt: 9_999_999,
    });
  });

  it('delete removes; the id is never reused', async () => {
    const db = await fresh();
    const a = await insertRoute(db, sampleCreated());
    expect(await deleteRoute(db, a)).toBe(true);
    expect(await deleteRoute(db, a)).toBe(false);
    expect(await listRoutes(db)).toEqual([]);
    const b = await insertRoute(db, sampleCreated());
    expect(b).toBeGreaterThan(a);
  });

  it('same savedAt: the last inserted first', async () => {
    const db = await fresh();
    const a = await insertRoute(db, sampleCreated({ savedAt: 7 }));
    const b = await insertRoute(db, sampleCreated({ savedAt: 7 }));
    expect((await listRoutes(db)).map((r) => r.id)).toEqual([b, a]);
  });

  it('empty list', async () => {
    expect(await listRoutes(await fresh())).toEqual([]);
  });
});

describe('C8 - unreadable rows and zone count', () => {
  const corrupt = async (
    db: Awaited<ReturnType<typeof fresh>>,
    set: string,
    id: number,
  ) => db.run(`UPDATE routes SET ${set} WHERE id = ?`, [id]);

  it('broken JSON in a created route: listed, zone kept, no throw', async () => {
    const db = await fresh();
    const ok = await insertRoute(db, sampleCreated({ name: 'ok', savedAt: 1 }));
    const bad = await insertRoute(
      db,
      sampleCreated({ name: 'bad', savedAt: 2 }),
    );
    await corrupt(db, "draft = '{not json'", bad);
    const list = await listRoutes(db);
    expect(list.map((r) => r.name)).toEqual(['bad', 'ok']);
    const r = await getRoute(db, bad);
    expect(r).toMatchObject({
      readable: false,
      origin: 'created',
      name: 'bad',
      zone: { id: 'nancy', version: 5, name: 'Nancy' },
    });
    expect((await getRoute(db, ok))!.readable).toBe(true);
  });

  it('broken legs JSON, legs of the wrong length', async () => {
    const db = await fresh();
    const a = await insertRoute(db, sampleCreated());
    await corrupt(db, "legs = 'oops'", a);
    expect((await getRoute(db, a))!.readable).toBe(false);
    const b = await insertRoute(db, sampleCreated());
    await corrupt(db, `legs = '[{"mode":"hand"}]'`, b);
    expect((await getRoute(db, b))!.readable).toBe(false);
    const c = await insertRoute(db, sampleCreated());
    // mode differs from the draft's mode
    await corrupt(db, `legs = '[{"mode":"hand"},{"mode":"hand"}]'`, c);
    expect((await getRoute(db, c))!.readable).toBe(false);
  });

  it('draft with coordinates out of range or duplicate ids', async () => {
    const db = await fresh();
    const mk = (points: string) =>
      `draft = '{"points":${points},"modes":["hand"]}'`;
    const cases = [
      '[{"id":1,"lon":200,"lat":0},{"id":2,"lon":1,"lat":1}]',
      '[{"id":1,"lon":0,"lat":95},{"id":2,"lon":1,"lat":1}]',
      '[{"id":1,"lon":0,"lat":0},{"id":1,"lon":1,"lat":1}]',
      '[{"id":1,"lon":0,"lat":0}]',
      '[{"id":0,"lon":0,"lat":0},{"id":2,"lon":1,"lat":1}]',
      '[{"id":1,"lon":"a","lat":0},{"id":2,"lon":1,"lat":1}]',
    ];
    for (const points of cases) {
      const id = await insertRoute(db, sampleCreated());
      await corrupt(db, mk(points), id);
      expect((await getRoute(db, id))!.readable).toBe(false);
    }
  });

  it('wrong polyline in a path leg, wrong gpx track', async () => {
    const db = await fresh();
    const a = await insertRoute(db, sampleCreated());
    await corrupt(
      db,
      `legs = '[{"mode":"path","zoneVersion":5,"distanceKm":1,"durationS":1,"shape":""},{"mode":"hand"}]'`,
      a,
    );
    expect((await getRoute(db, a))!.readable).toBe(false);
    const g = await insertRoute(db, sampleGpx());
    await corrupt(db, "track = ''", g);
    expect(await getRoute(db, g)).toMatchObject({
      readable: false,
      origin: 'gpx',
    });
    const g2 = await insertRoute(db, sampleGpx());
    await corrupt(db, "track = '_p~iF'", g2); // one half point
    expect((await getRoute(db, g2))!.readable).toBe(false);
  });

  it('gpx elevations of the wrong length or broken', async () => {
    const db = await fresh();
    const g = await insertRoute(db, sampleGpx());
    await corrupt(db, "elevations = '[1,2]'", g);
    expect((await getRoute(db, g))!.readable).toBe(false);
    await corrupt(db, "elevations = '[1,2'", g);
    expect((await getRoute(db, g))!.readable).toBe(false);
  });

  it('an unreadable gpx keeps its zone when readable', async () => {
    const db = await fresh();
    const g = await insertRoute(
      db,
      sampleGpx({ zone: { id: 'nancy', version: 5, name: 'Nancy' } }),
    );
    await corrupt(db, "track = 'zz'", g);
    expect(await getRoute(db, g)).toMatchObject({
      readable: false,
      zone: { id: 'nancy', version: 5, name: 'Nancy' },
    });
  });

  it('an unreadable route can be renamed, deleted', async () => {
    const db = await fresh();
    const a = await insertRoute(db, sampleCreated());
    await corrupt(db, "draft = 'x'", a);
    expect(await renameRoute(db, a, 'Nouveau nom')).toBe(true);
    expect((await getRoute(db, a))!.name).toBe('Nouveau nom');
    expect(await deleteRoute(db, a)).toBe(true);
  });

  it('countRoutesByZone', async () => {
    const db = await fresh();
    expect(await countRoutesByZone(db, 'nancy')).toBe(0);
    const a = await insertRoute(db, sampleCreated());
    await insertRoute(db, sampleCreated());
    await insertRoute(
      db,
      sampleGpx({ zone: { id: 'nancy', version: 4, name: 'Nancy' } }),
    );
    await insertRoute(db, sampleGpx()); // out of zone
    await insertRoute(
      db,
      sampleCreated({ zone: { id: 'metz', version: 1, name: 'Metz' } }),
    );
    expect(await countRoutesByZone(db, 'nancy')).toBe(3);
    expect(await countRoutesByZone(db, 'metz')).toBe(1);
    expect(await countRoutesByZone(db, 'lyon')).toBe(0);
    await corrupt(db, "draft = 'x'", a); // unreadable still counted
    expect(await countRoutesByZone(db, 'nancy')).toBe(3);
    await deleteRoute(db, a);
    expect(await countRoutesByZone(db, 'nancy')).toBe(2);
  });
});

describe('Security - names are data, not SQL', () => {
  const nasty = [
    "L'aventure",
    'a; DROP TABLE routes; --',
    "x'); DROP TABLE routes; --",
    "' OR '1'='1",
    'DROP TABLE routes',
    '--',
    'a"b`c\\d%_',
  ];
  it('insert and rename keep the name as is', async () => {
    const db = await fresh();
    const id = await insertRoute(db, sampleCreated());
    for (const name of nasty) {
      const n = await insertRoute(db, sampleCreated({ name }));
      expect((await getRoute(db, n))!.name).toBe(name);
      await renameRoute(db, id, name);
      expect((await getRoute(db, id))!.name).toBe(name);
    }
    expect(await listRoutes(db)).toHaveLength(nasty.length + 1);
    // the table is alive and a rename did not touch the other rows
    expect(await countRoutesByZone(db, 'nancy')).toBe(nasty.length + 1);
  });
  it('a nasty zone name and id are kept as is', async () => {
    const db = await fresh();
    const zone = { id: "z'; DROP TABLE routes;--", version: 1, name: "N'; --" };
    const id = await insertRoute(db, sampleCreated({ zone }));
    expect((await getRoute(db, id))!.zone).toEqual(zone);
    expect(await countRoutesByZone(db, zone.id)).toBe(1);
  });
});
