import { MIGRATIONS, migrate } from './migrations';
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
} from './routeRepo';
import { RouteNameError } from './routeName';
import { createNodeSqlDb, type NodeSqlDb } from './testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from './testing/sampleRoutes';

let db: NodeSqlDb;
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
});
afterEach(() => db.close());

describe('insertRoute and getRoute', () => {
  it('keeps a created route identical', async () => {
    const route = sampleCreated();
    const id = await insertRoute(db, route);
    expect(await getRoute(db, id)).toEqual({ ...route, id, readable: true });
  });

  it('keeps a GPX route identical', async () => {
    const route = sampleGpx();
    const id = await insertRoute(db, route);
    expect(await getRoute(db, id)).toEqual({ ...route, id, readable: true });
  });

  it('returns null for an unknown id', async () => {
    expect(await getRoute(db, 99)).toBeNull();
  });

  it('never reuses an id after a deletion (AUTOINCREMENT)', async () => {
    const first = await insertRoute(db, sampleGpx());
    await deleteRoute(db, first);
    const second = await insertRoute(db, sampleGpx());
    expect(second).toBeGreaterThan(first);
  });

  it('normalizes the name and refuses an empty or too long one', async () => {
    const id = await insertRoute(db, sampleGpx({ name: '  a \n b ' }));
    expect((await getRoute(db, id))?.name).toBe('a b');
    await expect(insertRoute(db, sampleGpx({ name: '  ' }))).rejects.toEqual(
      new RouteNameError('empty'),
    );
    await expect(
      insertRoute(db, sampleGpx({ name: 'a'.repeat(61) })),
    ).rejects.toBeInstanceOf(RouteNameError);
    expect(await listRoutes(db)).toHaveLength(1);
  });

  it('returns an unreadable route for a wrong row, without throwing', async () => {
    const id = await insertRoute(db, sampleCreated());
    await db.run("UPDATE routes SET draft = '{bad' WHERE id = ?", [id]);
    const route = await getRoute(db, id);
    expect(route?.readable).toBe(false);
    expect(route?.name).toBe('Boucle du Bois');
  });
});

describe('listRoutes', () => {
  it('sorts by last save or import, newest first, then by id', async () => {
    const a = await insertRoute(db, sampleGpx({ name: 'A', savedAt: 10 }));
    const b = await insertRoute(db, sampleGpx({ name: 'B', savedAt: 30 }));
    const c = await insertRoute(db, sampleGpx({ name: 'C', savedAt: 20 }));
    const d = await insertRoute(db, sampleGpx({ name: 'D', savedAt: 30 }));
    expect((await listRoutes(db)).map((r) => r.id)).toEqual([d, b, c, a]);
  });

  it('gives the light columns only', async () => {
    const id = await insertRoute(db, sampleCreated());
    const [item] = await listRoutes(db);
    expect(item).toEqual({
      id,
      name: 'Boucle du Bois',
      origin: 'created',
      createdAt: 1_000,
      savedAt: 1_000,
      zoneId: 'nancy',
      zoneName: 'Nancy',
      preview: '_p~iF~ps|U',
      distanceKm: 2.5,
      durationS: 700,
      ascentM: null,
      descentM: null,
      figuresAt: null,
    });
  });

  it('is empty for an empty database', async () => {
    expect(await listRoutes(db)).toEqual([]);
  });
});

describe('renameRoute', () => {
  it('changes the name and keeps the order and the dates', async () => {
    const a = await insertRoute(db, sampleGpx({ name: 'A', savedAt: 10 }));
    const b = await insertRoute(db, sampleGpx({ name: 'B', savedAt: 20 }));

    expect(await renameRoute(db, a, '  Nouveau nom ')).toBe(true);

    const list = await listRoutes(db);
    expect(list.map((r) => r.id)).toEqual([b, a]);
    expect(list[1]).toMatchObject({
      name: 'Nouveau nom',
      savedAt: 10,
      createdAt: 2_000,
    });
  });

  it('refuses an empty name and a 61-character name, changes nothing', async () => {
    const id = await insertRoute(db, sampleGpx({ name: 'A' }));
    await expect(renameRoute(db, id, ' ')).rejects.toEqual(
      new RouteNameError('empty'),
    );
    await expect(renameRoute(db, id, 'x'.repeat(61))).rejects.toEqual(
      new RouteNameError('tooLong'),
    );
    expect(await renameRoute(db, id, 'x'.repeat(60))).toBe(true);
    expect((await getRoute(db, id))?.name).toBe('x'.repeat(60));
  });

  it('returns false for an unknown id', async () => {
    expect(await renameRoute(db, 99, 'A')).toBe(false);
  });
});

describe('replaceRoute', () => {
  it('rewrites the track data, moves the route up, keeps name and creation date', async () => {
    const old = await insertRoute(db, sampleCreated({ name: 'Mon nom' }));
    const other = await insertRoute(db, sampleGpx({ savedAt: 5_000 }));
    const next = sampleCreated();
    const draft = {
      points: [
        { id: 1, lon: 6.18, lat: 48.69 },
        { id: 4, lon: 6.3, lat: 48.8 },
      ],
      modes: ['hand' as const],
    };

    const changed = await replaceRoute(db, old, {
      draft,
      legs: [{ mode: 'hand' }],
      zone: { id: 'nancy', version: 6, name: 'Nancy' },
      preview: next.preview,
      distanceKm: 9.9,
      durationS: 1234,
      ascentM: 120.4,
      descentM: 99,
      figuresAt: 7_000,
      savedAt: 8_000,
    });

    expect(changed).toBe(true);
    expect(await getRoute(db, old)).toMatchObject({
      name: 'Mon nom',
      createdAt: 1_000,
      savedAt: 8_000,
      draft,
      legs: [{ mode: 'hand' }],
      zone: { id: 'nancy', version: 6, name: 'Nancy' },
      distanceKm: 9.9,
      ascentM: 120,
      descentM: 99,
      figuresAt: 7_000,
    });
    expect((await listRoutes(db)).map((r) => r.id)).toEqual([old, other]);
  });

  it('does not touch a GPX route nor an unknown id', async () => {
    const gpx = await insertRoute(db, sampleGpx());
    const input = {
      ...sampleCreated(),
      savedAt: 9,
    };
    expect(await replaceRoute(db, gpx, input)).toBe(false);
    expect(await replaceRoute(db, 99, input)).toBe(false);
    expect(await getRoute(db, gpx)).toMatchObject({
      origin: 'gpx',
      savedAt: 2_000,
    });
  });
});

describe('deleteRoute', () => {
  it('removes only that route', async () => {
    const a = await insertRoute(db, sampleGpx({ name: 'A' }));
    const b = await insertRoute(db, sampleGpx({ name: 'B' }));
    expect(await deleteRoute(db, a)).toBe(true);
    expect((await listRoutes(db)).map((r) => r.id)).toEqual([b]);
    expect(await getRoute(db, a)).toBeNull();
    expect(await deleteRoute(db, a)).toBe(false);
  });
});

describe('updateFigures', () => {
  it('writes ascent, descent and their date, and keeps saved_at', async () => {
    const id = await insertRoute(db, sampleCreated());

    expect(await updateFigures(db, id, 312.6, 280, 5_000)).toBe(true);

    expect(await getRoute(db, id)).toMatchObject({
      ascentM: 313,
      descentM: 280,
      figuresAt: 5_000,
      savedAt: 1_000,
      distanceKm: 2.5,
    });
  });

  it('accepts null figures', async () => {
    const id = await insertRoute(db, sampleGpx());
    await updateFigures(db, id, null, null, 6_000);
    expect(await getRoute(db, id)).toMatchObject({
      ascentM: null,
      descentM: null,
      figuresAt: 6_000,
    });
  });
});

describe('countRoutesByZone', () => {
  it('counts the routes of a zone', async () => {
    await insertRoute(db, sampleCreated());
    await insertRoute(db, sampleCreated());
    await insertRoute(db, sampleGpx());
    await insertRoute(
      db,
      sampleGpx({ zone: { id: 'metz', version: 1, name: 'Metz' } }),
    );
    expect(await countRoutesByZone(db, 'nancy')).toBe(2);
    expect(await countRoutesByZone(db, 'metz')).toBe(1);
    expect(await countRoutesByZone(db, 'paris')).toBe(0);
  });
});

describe('newDefaultName', () => {
  it('numbers the routes of the same day: (2), (3)', async () => {
    const day = new Date(2026, 10, 3, 9, 0);
    const first = await newDefaultName(db, day);
    expect(first).toBe('Itinéraire du 3 nov.');
    await insertRoute(db, sampleGpx({ name: first }));

    const second = await newDefaultName(db, day);
    expect(second).toBe('Itinéraire du 3 nov. (2)');
    await insertRoute(db, sampleGpx({ name: second }));

    expect(await newDefaultName(db, day)).toBe('Itinéraire du 3 nov. (3)');
    expect(await newDefaultName(db, new Date(2026, 10, 4))).toBe(
      'Itinéraire du 4 nov.',
    );
  });
});
