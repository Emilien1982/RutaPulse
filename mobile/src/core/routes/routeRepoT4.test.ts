import { MIGRATIONS, migrate } from './migrations';
import { attachZone, getRoute, insertRoute } from './routeRepo';
import { createNodeSqlDb, type NodeSqlDb } from './testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from './testing/sampleRoutes';

let db: NodeSqlDb;
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
});
afterEach(() => db.close());

const zone = { id: 'nancy', version: 5, name: 'Nancy' };

describe('attachZone', () => {
  it('gives a zone to a GPX that has none, once', async () => {
    const id = await insertRoute(db, sampleGpx());
    expect(await attachZone(db, id, zone)).toBe(true);
    expect((await getRoute(db, id))?.zone).toEqual(zone);
    expect(
      await attachZone(db, id, { id: 'metz', version: 1, name: 'Metz' }),
    ).toBe(false);
    expect((await getRoute(db, id))?.zone).toEqual(zone);
  });

  it('never touches a created route', async () => {
    const id = await insertRoute(db, sampleCreated());
    expect(
      await attachZone(db, id, { id: 'metz', version: 1, name: 'Metz' }),
    ).toBe(false);
  });
});
