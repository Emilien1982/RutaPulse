// "Dupliquer" (ADR 0020, section 7 bis; spec C16), on a real SQLite.

import { MIGRATIONS, migrate } from './migrations';
import { describeRoute } from './routeList';
import {
  duplicateRoute,
  getRoute,
  insertRoute,
  listRoutes,
  renameRoute,
  replaceGpx,
  replaceRoute,
} from './routeRepo';
import { createNodeSqlDb, type NodeSqlDb } from './testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from './testing/sampleRoutes';
import { copyName } from './routeName';

let db: NodeSqlDb;
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
});
afterEach(() => db.close());

const NOW = 9_000_000;
const ZONE = { id: 'nancy', version: 5, name: 'Nancy' };
type Row = Record<string, unknown>;
const rowOf = (id: number) =>
  db.first<Row>('SELECT * FROM routes WHERE id = ?', [id]);
const count = async () =>
  (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM routes'))!.n;

describe('duplicateRoute', () => {
  const makers: [string, () => Parameters<typeof insertRoute>[1]][] = [
    ['created', () => sampleCreated()],
    ['gpx with altitudes', () => sampleGpx({ zone: ZONE })],
    ['gpx without zone', () => sampleGpx({ zone: null })],
    ['trail', () => sampleCreated({ origin: 'trail' })],
    [
      'editedGpx',
      () => sampleCreated({ origin: 'editedGpx', createdAt: 5, savedAt: 6 }),
    ],
  ];

  it.each(makers)('copies a %s route, column by column', async (_, make) => {
    await insertRoute(db, sampleCreated({ name: 'Autre' }));
    const id = await insertRoute(db, make());
    const copyId = await duplicateRoute(db, id, NOW);
    const max = (await db.first<{ m: number }>(
      'SELECT MAX(id) AS m FROM routes',
    ))!.m;
    expect(copyId).not.toBeNull();
    expect(copyId).toBe(max);
    expect(copyId!).toBeGreaterThan(id);
    const original = (await rowOf(id))!;
    const copy = (await rowOf(copyId!))!;
    const {
      id: _a,
      name: _b,
      created_at: _c,
      saved_at: _d,
      ...same
    } = original;
    const { id: _e, name, created_at, saved_at, ...copied } = copy;
    expect(copied).toEqual(same);
    expect(name).toBe(`${original.name as string} (copie)`);
    expect(created_at).toBe(NOW);
    expect(saved_at).toBe(NOW);
    expect(await count()).toBe(3);
  });

  it('keeps the altitudes and the missing zone of a GPX', async () => {
    const id = await insertRoute(db, sampleGpx({ zone: null }));
    const copy = await getRoute(db, (await duplicateRoute(db, id, NOW))!);
    expect(copy).toMatchObject({
      origin: 'gpx',
      zone: null,
      elevations: [212, null, 215.5],
    });
  });

  it('copies an unreadable row as it is', async () => {
    const id = await insertRoute(db, sampleCreated());
    await db.run("UPDATE routes SET legs = 'oops' WHERE id = ?", [id]);
    const copyId = (await duplicateRoute(db, id, NOW))!;
    expect((await rowOf(copyId))!.legs).toBe('oops');
  });

  it('puts the copy first in the list', async () => {
    const a = await insertRoute(db, sampleCreated({ name: 'A', savedAt: 5 }));
    await insertRoute(db, sampleCreated({ name: 'B', savedAt: 7 }));
    const copyId = await duplicateRoute(db, a, NOW);
    const list = await listRoutes(db);
    expect(list.map((r) => r.id)[0]).toBe(copyId);
    expect(list.map((r) => r.name)).toEqual(['A (copie)', 'B', 'A']);
  });

  it('names the copies "(copie)", "(copie 2)", the first free number', async () => {
    const id = await insertRoute(db, sampleCreated({ name: 'X' }));
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      const copyId = await duplicateRoute(db, id, NOW + i);
      names.push((await getRoute(db, copyId!))!.name);
    }
    expect(names).toEqual(['X (copie)', 'X (copie 2)', 'X (copie 3)']);
    const second = (await listRoutes(db)).find(
      (r) => r.name === 'X (copie 2)',
    )!;
    await renameRoute(db, second.id, 'Libre');
    const again = await duplicateRoute(db, id, NOW + 9);
    expect((await getRoute(db, again!))!.name).toBe('X (copie 2)');
  });

  it('does not read the name: the copy of "X (copie)" is "X (copie) (copie)"', async () => {
    const id = await insertRoute(db, sampleCreated({ name: 'X (copie)' }));
    const copyId = await duplicateRoute(db, id, NOW);
    expect((await getRoute(db, copyId!))!.name).toBe('X (copie) (copie)');
  });

  it('shortens a 60-character name (with an emoji), the suffix whole', async () => {
    const name = `${'é'.repeat(59)}🚵`;
    expect([...name]).toHaveLength(60);
    const id = await insertRoute(db, sampleCreated({ name }));
    const first = (await getRoute(db, (await duplicateRoute(db, id, NOW))!))!;
    expect([...first.name]).toHaveLength(60);
    expect(first.name.endsWith(' (copie)')).toBe(true);
    expect(first.name.startsWith('é'.repeat(52))).toBe(true);
    const second = (await getRoute(db, (await duplicateRoute(db, id, NOW))!))!;
    expect([...second.name].length).toBeLessThanOrEqual(60);
    expect(second.name.endsWith(' (copie 2)')).toBe(true);
  });

  it('returns null and writes nothing for a missing route', async () => {
    await insertRoute(db, sampleCreated());
    expect(await duplicateRoute(db, 999, NOW)).toBeNull();
    expect(await count()).toBe(1);
  });

  it('gives two quick copies two different names', async () => {
    const id = await insertRoute(db, sampleCreated({ name: 'X' }));
    const [a, b] = await Promise.all([
      duplicateRoute(db, id, NOW),
      duplicateRoute(db, id, NOW),
    ]);
    const names = [
      (await getRoute(db, a!))!.name,
      (await getRoute(db, b!))!.name,
    ];
    expect(new Set(names).size).toBe(2);
  });

  it('leaves the original identical when the copy of a route is modified', async () => {
    const id = await insertRoute(db, sampleCreated());
    const before = await rowOf(id);
    const copyId = (await duplicateRoute(db, id, NOW))!;
    const input = {
      draft: sampleCreated().draft!,
      legs: sampleCreated().legs!,
      zone: ZONE,
      preview: 'zz',
      distanceKm: 99,
      durationS: 1,
      ascentM: 5,
      descentM: 6,
      figuresAt: 7,
      savedAt: NOW + 1,
    };
    expect(await replaceRoute(db, copyId, input)).toBe(true);
    expect((await rowOf(copyId))!.distance_km).toBe(99);
    expect(await rowOf(id)).toEqual(before);
  });

  it('leaves the original GPX identical when the copy becomes an editedGpx', async () => {
    const id = await insertRoute(db, sampleGpx({ zone: ZONE }));
    const before = await rowOf(id);
    const copyId = (await duplicateRoute(db, id, NOW))!;
    const created = sampleCreated();
    const input = {
      draft: created.draft!,
      legs: created.legs!,
      zone: ZONE,
      preview: 'zz',
      distanceKm: 99,
      durationS: 1,
      ascentM: null,
      descentM: null,
      figuresAt: null,
      savedAt: NOW + 1,
    };
    expect(await replaceGpx(db, copyId, input)).toBe(true);
    expect((await rowOf(copyId))!.origin).toBe('editedGpx');
    expect(await rowOf(id)).toEqual(before);
  });

  it('says "circuit balisé, le ..." for the copy of a modified circuit', async () => {
    const nov3 = new Date(2026, 10, 3, 10).getTime();
    const nov5 = new Date(2026, 10, 5, 10).getTime();
    const id = await insertRoute(
      db,
      sampleCreated({ origin: 'trail', createdAt: nov3, savedAt: nov5 }),
    );
    const copyId = (await duplicateRoute(db, id, nov5 + 1000))!;
    const list = await listRoutes(db);
    const line = (rid: number) =>
      describeRoute(
        list.find((r) => r.id === rid)!,
        'usable',
        2026,
      ).meta;
    expect(line(id)).toContain('circuit modifié le 5 nov.');
    expect(line(copyId)).toContain('circuit balisé, le 5 nov.');
  });

  it('says "GPX modifié le ..." for the copy of an edited GPX', async () => {
    const nov5 = new Date(2026, 10, 5, 10).getTime();
    const id = await insertRoute(
      db,
      sampleCreated({ origin: 'editedGpx', createdAt: 1, savedAt: nov5 }),
    );
    const copyId = (await duplicateRoute(db, id, nov5))!;
    const list = await listRoutes(db);
    expect(
      describeRoute(
        list.find((r) => r.id === copyId)!,
        'usable',
        2026,
      ).meta,
    ).toContain('GPX modifié le 5 nov.');
  });
});

describe('copyName', () => {
  it('takes the first free name', () => {
    expect(copyName('X', [])).toBe('X (copie)');
    expect(copyName('X', ['X (copie)', 'X (copie 3)'])).toBe('X (copie 2)');
  });
});
