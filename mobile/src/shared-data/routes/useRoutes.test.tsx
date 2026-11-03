// Reads and writes of saved routes, on a real SQLite (node:sqlite): the writes
// invalidate what they change (ADR 0019, section 10).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { getRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';

import {
  routeDetailKey,
  routesListKey,
  useRouteActions,
  useRouteCountByZone,
  useRoutes,
  useSavedRoute,
} from './useRoutes';

let mockDb: NodeSqlDb;
jest.mock('./routesDb', () => ({ getRoutesDb: () => Promise.resolve(mockDb) }));

let client: QueryClient;
let reads: string[];

beforeEach(async () => {
  mockDb = createNodeSqlDb();
  await migrate(mockDb, MIGRATIONS);
  // gcTime Infinity: no garbage-collection timer keeps Jest alive.
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  reads = [];
  // Counts the real reads of the database, one line per SELECT.
  const all = mockDb.all;
  const first = mockDb.first;
  mockDb.all = ((sql: string, params?: never) => {
    reads.push(sql.includes('COUNT') ? 'count' : 'list');
    return all(sql, params);
  }) as typeof mockDb.all;
  mockDb.first = ((sql: string, params?: never) => {
    reads.push(sql.includes('COUNT') ? 'count' : 'detail');
    return first(sql, params);
  }) as typeof mockDb.first;
});
afterEach(() => {
  client.clear();
  mockDb.close();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function renderAll(id: number) {
  return renderHook(
    () => ({
      list: useRoutes(),
      detail: useSavedRoute(id),
      count: useRouteCountByZone('nancy'),
      actions: useRouteActions(),
    }),
    { wrapper },
  );
}

it('reads the list, a route and the count of a zone', async () => {
  const { actions } = (await renderAll(1)).result.current;
  await act(async () => {
    await actions.create({ ...sampleCreated(), now: Date.UTC(2026, 10, 3) });
  });
  const { result } = await renderAll(1);
  await waitFor(() => expect(result.current.count.data).toBe(1));
  expect(result.current.list.data?.map((r) => r.name)).toEqual([
    'Boucle du Bois',
  ]);
  expect(result.current.detail.data).toMatchObject({ id: 1, readable: true });
});

it('gives null for a route that does not exist', async () => {
  const { result } = await renderAll(42);
  await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
  expect(result.current.detail.data).toBeNull();
});

it('does not read again by itself (staleTime Infinity)', async () => {
  const { result, rerender } = await renderAll(1);
  await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
  const before = reads.length;
  await rerender({});
  await renderAll(1);
  expect(reads.length).toBe(before);
});

describe('invalidation', () => {
  async function setup() {
    const view = await renderAll(1);
    await act(async () => {
      await view.result.current.actions.create({
        ...sampleCreated({ name: 'Un' }),
        now: 1_000,
      });
    });
    await waitFor(() => expect(view.result.current.count.data).toBe(1));
    await waitFor(() => expect(view.result.current.detail.data).toBeTruthy());
    reads.length = 0;
    return view;
  }
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));

  it('create: refreshes the list and the counts', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.actions.create({ ...sampleGpx(), now: 2_000 });
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    expect(reads).toContain('count');
  });

  it('create without a name: default name, then (2) the same day', async () => {
    const { result } = await renderAll(1);
    const now = new Date(2026, 10, 3, 10).getTime();
    await act(async () => {
      await result.current.actions.create({
        ...sampleGpx(),
        name: undefined,
        now,
      });
      await result.current.actions.create({
        ...sampleGpx(),
        name: undefined,
        now,
      });
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    expect(result.current.list.data?.map((r) => r.name).sort()).toEqual([
      'Itinéraire du 3 nov.',
      'Itinéraire du 3 nov. (2)',
    ]);
  });

  it('rename: refreshes the list and that route, not the counts', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.actions.rename(1, 'Deux');
    });
    await waitFor(() =>
      expect(result.current.list.data?.[0].name).toBe('Deux'),
    );
    await waitFor(() => expect(result.current.detail.data?.name).toBe('Deux'));
    expect(reads).toContain('list');
    expect(reads).toContain('detail');
    expect(reads).not.toContain('count');
  });

  it('replace: refreshes the list, the route and the counts', async () => {
    const { result } = await setup();
    const input = sampleCreated({ distanceKm: 8, savedAt: 9_000 });
    await act(async () => {
      await result.current.actions.replace(1, input);
    });
    await waitFor(() =>
      expect(result.current.list.data?.[0].distanceKm).toBe(8),
    );
    await waitFor(() => expect(result.current.detail.data?.distanceKm).toBe(8));
    expect(reads).toContain('count');
  });

  it('remove: drops the route, refreshes the list and the counts', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.actions.remove(1);
    });
    await waitFor(() => expect(result.current.list.data).toEqual([]));
    await waitFor(() => expect(result.current.count.data).toBe(0));
    expect(client.getQueryData(routeDetailKey(1))).toBeNull();
  });

  it('updateFigures: refreshes the list only', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.actions.updateFigures(1, 300, 280, 5_000);
    });
    await waitFor(() =>
      expect(result.current.list.data?.[0].ascentM).toBe(300),
    );
    await settle();
    expect(reads).toEqual(['list']);
    expect(client.getQueryState(routesListKey)?.isInvalidated).toBe(false);
    expect(result.current.detail.data).toMatchObject({ ascentM: null });
  });
});

describe('create, typed by origin', () => {
  it('accepts a created route and a GPX route written out in full', async () => {
    const { result } = await renderAll(1);
    const { actions } = result.current;
    let created = 0;
    let gpx = 0;
    await act(async () => {
      created = await actions.create({
        origin: 'created',
        zone: { id: 'nancy', version: 5, name: 'Nancy' },
        draft: {
          points: [
            { id: 1, lon: 6.18, lat: 48.69 },
            { id: 2, lon: 6.19, lat: 48.7 },
          ],
          modes: ['hand'],
        },
        legs: [{ mode: 'hand' }],
        preview: '_p~iF~ps|U',
        distanceKm: 1,
        durationS: 360,
        ascentM: null,
        descentM: null,
        figuresAt: null,
        now: 1_000,
      });
      gpx = await actions.create({
        origin: 'gpx',
        name: 'Trace',
        zone: null,
        track: [
          [6.18, 48.69],
          [6.19, 48.7],
        ],
        elevations: null,
        preview: '_p~iF~ps|U',
        distanceKm: 1,
        durationS: 360,
        ascentM: null,
        descentM: null,
        figuresAt: null,
        now: 2_000,
      });
    });
    expect(await getRoute(mockDb, created)).toMatchObject({
      origin: 'created',
      readable: true,
    });
    expect(await getRoute(mockDb, gpx)).toMatchObject({
      origin: 'gpx',
      readable: true,
    });
  });

  it('refuses a GPX route without track at typecheck', async () => {
    const { result } = await renderHook(() => useRouteActions(), { wrapper });
    const noTrack = {
      origin: 'gpx' as const,
      name: 'Sans trace',
      zone: null,
      elevations: null,
      preview: '',
      distanceKm: 1,
      durationS: 1,
      ascentM: null,
      descentM: null,
      figuresAt: null,
    };
    // @ts-expect-error a GPX route needs its track
    const call = () => result.current.create(noTrack);
    await expect(call()).rejects.toThrow();
  });
});
