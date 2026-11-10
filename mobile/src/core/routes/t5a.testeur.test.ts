// Tester's tests for T5a, written from the spec (C9) and ADR 0020 sections 7 and 10.

import { MIGRATIONS, migrate } from './migrations';
import { reopenDraft } from './reopen';
import { getRoute, insertRoute, listRoutes, replaceGpx } from './routeRepo';
import { describeRoute } from './routeList';
import { trailRouteName, uniqueDefaultName } from './routeName';
import { originText } from './routeText';
import { rowToRoute, type CreatedRoute, type RouteRow } from './savedRoute';
import { createNodeSqlDb } from './testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from './testing/sampleRoutes';

const local = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).getTime();

// Raw INSERT, independent of the app's writers.
const RAW =
  'INSERT INTO routes (name, origin, created_at, saved_at, preview, distance_km, duration_s, zone_id, zone_version, zone_name, draft, legs, track, elevations) VALUES (?, ?, 1, 1, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)';
const D = '{"points":[],"modes":[]}';

async function v1Base() {
  const db = createNodeSqlDb();
  await migrate(db, MIGRATIONS.slice(0, 1));
  const a = await insertRoute(db, sampleCreated());
  const b = await insertRoute(
    db,
    sampleGpx({ zone: { id: 'n', version: 5, name: 'N' } }),
  );
  const c = await insertRoute(
    db,
    sampleGpx({ name: 'Sans zone', zone: null, elevations: null }),
  );
  const d = await insertRoute(db, sampleCreated({ name: 'Supprimé' }));
  await db.run('DELETE FROM routes WHERE id = ?', [d]);
  return { db, ids: [a, b, c], deleted: d };
}

describe('T5a testeur: migration v1 to v2', () => {
  it('keeps every row column by column, reaches version 2, and the counter holds', async () => {
    const { db, ids, deleted } = await v1Base();
    const before = await db.all<RouteRow>('SELECT * FROM routes ORDER BY id');
    expect(before).toHaveLength(3);
    const res = await migrate(db, MIGRATIONS);
    expect(res).toEqual({ status: 'ready', version: 2 });
    const after = await db.all<RouteRow>('SELECT * FROM routes ORDER BY id');
    expect(after).toEqual(before);
    expect(after.map((r) => r.id)).toEqual(ids);
    expect(after.map(rowToRoute)).toEqual(before.map(rowToRoute));
    expect(after.every((r) => rowToRoute(r).readable)).toBe(true);
    // next number is above the largest ever given (the deleted one)
    const next = await insertRoute(db, sampleCreated({ name: 'Nouveau' }));
    expect(next).toBeGreaterThan(deleted);
    expect(next).toBe(deleted + 1);
  });

  it('accepts trail and editedGpx with draft and legs, refuses the forbidden rows', async () => {
    const { db } = await v1Base();
    await migrate(db, MIGRATIONS);
    const z: [string, number, string] = ['n', 1, 'N'];
    for (const o of ['trail', 'editedGpx']) {
      await db.run(RAW, ['x', o, 'p', ...z, D, '[]', null, null]);
    }
    const bad: [string, unknown[]][] = [
      [
        'trail without draft',
        ['x', 'trail', 'p', ...z, null, '[]', null, null],
      ],
      ['trail without legs', ['x', 'trail', 'p', ...z, D, null, null, null]],
      ['trail with track', ['x', 'trail', 'p', ...z, D, '[]', 't', null]],
      [
        'trail with elevations',
        ['x', 'trail', 'p', ...z, D, '[]', null, '[1]'],
      ],
      [
        'editedGpx without zone',
        ['x', 'editedGpx', 'p', null, null, null, D, '[]', null, null],
      ],
      ['unknown origin', ['x', 'bogus', 'p', ...z, D, '[]', null, null]],
      ['gpx with draft', ['x', 'gpx', 'p', ...z, D, '[]', 't', null]],
      ['gpx without track', ['x', 'gpx', 'p', ...z, null, null, null, null]],
    ];
    for (const [label, params] of bad) {
      await expect(db.run(RAW, params as never)).rejects.toThrow();
      void label;
    }
  });

  it('a new base and a climbed base have the same schema', async () => {
    const { db } = await v1Base();
    await migrate(db, MIGRATIONS);
    const fresh = createNodeSqlDb();
    expect(await migrate(fresh, MIGRATIONS)).toEqual({
      status: 'ready',
      version: 2,
    });
    const q =
      "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name";
    expect(await db.all(q)).toEqual(await fresh.all(q));
  });

  it('opening twice changes nothing; version 99 is too new and untouched', async () => {
    const { db } = await v1Base();
    await migrate(db, MIGRATIONS);
    const snap = await db.all('SELECT * FROM routes');
    expect(await migrate(db, MIGRATIONS)).toEqual({
      status: 'ready',
      version: 2,
    });
    expect(await db.all('SELECT * FROM routes')).toEqual(snap);
    const old = createNodeSqlDb();
    await old.exec('PRAGMA user_version = 99');
    expect(await migrate(old, MIGRATIONS)).toEqual({
      status: 'tooNew',
      version: 99,
    });
    expect(await old.all('SELECT name FROM sqlite_master')).toEqual([]);
  });

  it('a failure in migration 2 leaves version 1, table and rows', async () => {
    const { db } = await v1Base();
    const before = await db.all('SELECT * FROM routes');
    const broken = [
      MIGRATIONS[0],
      async (tx: Parameters<(typeof MIGRATIONS)[1]>[0]) => {
        await MIGRATIONS[1](tx);
        await tx.exec('SELECT * FROM table_that_does_not_exist');
      },
    ];
    await expect(migrate(db, broken)).rejects.toThrow();
    expect(
      (await db.first<{ user_version: number }>('PRAGMA user_version'))!
        .user_version,
    ).toBe(1);
    expect(await db.all('SELECT * FROM routes')).toEqual(before);
    await expect(
      db.run(RAW, ['x', 'trail', 'p', 'n', 1, 'N', D, '[]', null, null]),
    ).rejects.toThrow();
  });

  it('an empty v1 table climbs and first id is 1', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS.slice(0, 1));
    await migrate(db, MIGRATIONS);
    expect(await insertRoute(db, sampleCreated())).toBe(1);
  });
});

describe('T5a testeur: origin texts', () => {
  const d1 = local(2026, 11, 9);
  const d2 = local(2025, 3, 3);
  const o = (
    origin: 'trail' | 'editedGpx' | 'created' | 'gpx',
    c: number,
    s: number,
    y: boolean,
  ) => originText({ origin, createdAt: c, savedAt: s }, y);

  it('trail never saved again: circuit balisé, le <created>', () => {
    expect(o('trail', d1, d1, false)).toBe('circuit balisé, le 9 nov.');
    expect(o('trail', d2, d2, true)).toBe('circuit balisé, le 3 mars 2025');
  });
  it('trail saved again: circuit modifié le <saved>', () => {
    expect(o('trail', d2, d1, false)).toBe('circuit modifié le 9 nov.');
    expect(o('trail', d2, d1, true)).toBe('circuit modifié le 9 nov. 2026');
  });
  it('editedGpx: GPX modifié le <saved>, even when created = saved', () => {
    expect(o('editedGpx', d2, d1, false)).toBe('GPX modifié le 9 nov.');
    expect(o('editedGpx', d2, d1, true)).toBe('GPX modifié le 9 nov. 2026');
    expect(o('editedGpx', d1, d1, true)).toBe('GPX modifié le 9 nov. 2026');
  });
  it('unchanged origins keep their texts', () => {
    expect(o('created', d2, d2, false)).toBe('créé le 3 mars');
    expect(o('created', d2, d1, false)).toBe('modifié le 9 nov.');
    expect(o('gpx', d2, d1, true)).toBe('GPX importé le 3 mars 2025');
  });
  it('the list shows the year from the date the text uses', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const mk = (
      origin: 'trail' | 'editedGpx',
      createdAt: number,
      savedAt: number,
    ) => insertRoute(db, sampleCreated({ origin, createdAt, savedAt }));
    await mk('trail', d2, d2); // old, never resaved: year
    await mk('trail', d2, d1); // resaved this year: no year
    await mk('editedGpx', d2, d1); // saved this year: no year
    const list = await listRoutes(db);
    const meta = new Map(
      list.map((r) => [r.id, describeRoute(r, 'usable', 2026).meta]),
    );
    expect(meta.get(1)).toContain('circuit balisé, le 3 mars 2025');
    expect(meta.get(2)).toContain('circuit modifié le 9 nov.');
    expect(meta.get(2)).not.toContain('2026');
    expect(meta.get(3)).toContain('GPX modifié le 9 nov.');
    expect(meta.get(3)).not.toContain('2026');
  });
});

describe('T5a testeur: default name of a circuit', () => {
  const date = new Date(2026, 10, 9, 12);
  it('name first, then ref, then dated name', () => {
    expect(
      trailRouteName({ name: 'Sentier des Roches', ref: '12' }, date),
    ).toBe('Sentier des Roches');
    expect(trailRouteName({ ref: '12' }, date)).toBe('Circuit 12');
    expect(trailRouteName({ name: '   ', ref: ' ' }, date)).toBe(
      'Circuit du 9 nov.',
    );
    expect(trailRouteName({}, date)).toBe('Circuit du 9 nov.');
  });
  it('(2), (3) and smallest free number', () => {
    expect(uniqueDefaultName('Boucle', [])).toBe('Boucle');
    expect(uniqueDefaultName('Boucle', ['Boucle'])).toBe('Boucle (2)');
    expect(uniqueDefaultName('Boucle', ['Boucle', 'Boucle (2)'])).toBe(
      'Boucle (3)',
    );
    expect(uniqueDefaultName('Boucle', ['Boucle', 'Boucle (3)'])).toBe(
      'Boucle (2)',
    );
  });
  it('never exceeds 60 characters, even with (2) and accents', () => {
    const long = 'é'.repeat(80);
    const base = trailRouteName({ name: long }, date);
    expect([...base]).toHaveLength(60);
    const second = uniqueDefaultName(base, [base]);
    expect([...second].length).toBeLessThanOrEqual(60);
    expect(second.endsWith(' (2)')).toBe(true);
    const third = uniqueDefaultName(base, [base, second]);
    expect([...third].length).toBeLessThanOrEqual(60);
    expect(third.endsWith(' (3)')).toBe(true);
    expect(new Set([base, second, third]).size).toBe(3);
  });
});

describe('T5a testeur: replaceGpx', () => {
  const input = () => {
    const c = sampleCreated({
      savedAt: 9_999,
      ascentM: 10.4,
      descentM: 3.6,
      figuresAt: 8_000,
    });
    return {
      draft: c.draft,
      legs: c.legs,
      zone: c.zone,
      preview: 'NEWPREVIEW',
      distanceKm: 7.7,
      durationS: 1234,
      ascentM: c.ascentM,
      descentM: c.descentM,
      figuresAt: c.figuresAt,
      savedAt: c.savedAt,
    };
  };

  it('same row: id, name, created_at kept; origin editedGpx; track and elevations NULL', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const other = await insertRoute(db, sampleGpx({ name: 'Autre' }));
    const id = await insertRoute(
      db,
      sampleGpx({ name: 'Mon GPX', createdAt: 2_000 }),
    );
    expect(await replaceGpx(db, id, input())).toBe(true);
    const row = (await db.first<RouteRow>('SELECT * FROM routes WHERE id = ?', [
      id,
    ]))!;
    expect(row.id).toBe(id);
    expect(row.name).toBe('Mon GPX');
    expect(row.created_at).toBe(2_000);
    expect(row.saved_at).toBe(9_999);
    expect(row.origin).toBe('editedGpx');
    expect(row.track).toBeNull();
    expect(row.elevations).toBeNull();
    expect(row.preview).toBe('NEWPREVIEW');
    expect(row.zone_id).toBe('nancy');
    const r = (await getRoute(db, id)) as CreatedRoute;
    expect(r.readable).toBe(true);
    expect(r.origin).toBe('editedGpx');
    expect(r.legs).toHaveLength(2);
    expect(await db.first('SELECT COUNT(*) AS n FROM routes')).toEqual({
      n: 2,
    });
    expect(((await getRoute(db, other)) as { origin: string }).origin).toBe(
      'gpx',
    );
  });

  it('returns false and writes nothing for a missing id or a non-GPX row', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const cid = await insertRoute(db, sampleCreated());
    const before = await db.all('SELECT * FROM routes');
    expect(await replaceGpx(db, 999, input())).toBe(false);
    expect(await replaceGpx(db, cid, input())).toBe(false);
    expect(await db.all('SELECT * FROM routes')).toEqual(before);
  });

  it('an already edited GPX is not a GPX any more', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(db, sampleGpx());
    expect(await replaceGpx(db, id, input())).toBe(true);
    expect(await replaceGpx(db, id, input())).toBe(false);
  });
});

describe('T5a testeur: trace marker', () => {
  const traceLegs = (): CreatedRoute['legs'] => [
    {
      mode: 'path',
      zoneVersion: 5,
      distanceKm: 1,
      durationS: 60,
      shape: [
        [6.18, 48.69],
        [6.19, 48.7],
      ],
      trace: true,
    },
    {
      mode: 'path',
      zoneVersion: 5,
      distanceKm: 2,
      durationS: 90,
      shape: [
        [6.19, 48.7],
        [6.2, 48.71],
      ],
    },
  ];

  it('is written, read back, absent when not set, in a real database', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(
      db,
      sampleCreated({
        origin: 'trail',
        draft: {
          points: [
            { id: 1, lon: 6.18, lat: 48.69 },
            { id: 2, lon: 6.19, lat: 48.7 },
            { id: 3, lon: 6.2, lat: 48.71 },
          ],
          modes: ['path', 'path'],
        },
        legs: traceLegs(),
      }),
    );
    const raw = (await db.first<{ legs: string }>(
      'SELECT legs FROM routes WHERE id = ?',
      [id],
    ))!;
    const parsed = JSON.parse(raw.legs);
    expect(parsed[0].trace).toBe(true);
    expect('trace' in parsed[1]).toBe(false);
    const r = (await getRoute(db, id)) as CreatedRoute;
    expect(r.legs[0]).toMatchObject({ trace: true });
    expect('trace' in r.legs[1]).toBe(false);
  });

  it('reopenDraft recopies the marker on kept legs only for marked legs', async () => {
    const db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    const id = await insertRoute(
      db,
      sampleCreated({
        origin: 'editedGpx',
        draft: {
          points: [
            { id: 1, lon: 6.18, lat: 48.69 },
            { id: 2, lon: 6.19, lat: 48.7 },
            { id: 3, lon: 6.2, lat: 48.71 },
          ],
          modes: ['path', 'path'],
        },
        legs: traceLegs(),
      }),
    );
    const r = (await getRoute(db, id)) as CreatedRoute;
    const { kept } = reopenDraft(r);
    const [first, second] = [...kept.values()];
    expect(first.trace).toBe(true);
    expect(second.trace).toBeUndefined();
    expect('trace' in second).toBe(false);
  });
});
