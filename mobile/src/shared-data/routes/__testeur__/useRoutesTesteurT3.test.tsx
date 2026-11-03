// Tester tests (spec C5, ADR 0019 section 10): the list and the detail follow
// each write at once, through TanStack Query, on a real SQLite.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';

import {
  createRouteActions,
  useRouteCountByZone,
  useRoutes,
  useSavedRoute,
} from '../useRoutes';

let mockDb: NodeSqlDb;
jest.mock('../routesDb', () => ({
  getRoutesDb: () => Promise.resolve(mockDb),
}));

let client: QueryClient;
beforeEach(async () => {
  mockDb = createNodeSqlDb();
  await migrate(mockDb, MIGRATIONS);
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
});
afterEach(() => {
  client.clear();
  mockDb.close();
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const NOV3 = new Date(2026, 10, 3, 12).getTime();

async function setup(id = 0) {
  const actions = createRouteActions(client);
  const hook = await renderHook(
    () => ({
      list: useRoutes(),
      detail: useSavedRoute(id),
      count: useRouteCountByZone('nancy'),
    }),
    { wrapper },
  );
  return { actions, hook };
}

describe('Query follows the writes', () => {
  it('create: default names, then list and count updated', async () => {
    const { actions, hook } = await setup();
    await waitFor(() => expect(hook.result.current.list.data).toEqual([]));
    expect(hook.result.current.count.data).toBe(0);
    await act(async () => {
      await actions.create({ ...sampleCreated(), name: undefined, now: NOV3 });
    });
    await act(async () => {
      await actions.create({ ...sampleCreated(), name: undefined, now: NOV3 });
    });
    await waitFor(() =>
      expect(hook.result.current.list.data?.map((r) => r.name)).toEqual([
        'Itinéraire du 3 nov. (2)',
        'Itinéraire du 3 nov.',
      ]),
    );
    await waitFor(() => expect(hook.result.current.count.data).toBe(2));
  });

  it('import goes first; rename keeps order and updates list and detail', async () => {
    const a = await createRouteActions(client).create({
      ...sampleCreated(),
      name: 'A',
      now: 1000,
    });
    const { actions, hook } = await setup(a);
    await waitFor(() =>
      expect(hook.result.current.detail.data?.name).toBe('A'),
    );
    let g = 0;
    await act(async () => {
      g = await actions.create({ ...sampleGpx(), name: 'G', now: 2000 });
    });
    await waitFor(() =>
      expect(hook.result.current.list.data?.map((r) => r.id)).toEqual([g, a]),
    );
    await act(async () => {
      await actions.rename(a, '  Renommé  ');
    });
    await waitFor(() =>
      expect(hook.result.current.detail.data?.name).toBe('Renommé'),
    );
    expect(hook.result.current.list.data?.map((r) => [r.id, r.name])).toEqual([
      [g, 'G'],
      [a, 'Renommé'],
    ]);
  });

  it('rename with an invalid name rejects and changes nothing', async () => {
    const { actions, hook } = await setup();
    const id = await actions.create({ ...sampleCreated(), name: 'A' });
    await waitFor(() => expect(hook.result.current.list.data).toHaveLength(1));
    await expect(actions.rename(id, '   ')).rejects.toThrow();
    await expect(actions.rename(id, 'x'.repeat(61))).rejects.toThrow();
    expect(hook.result.current.list.data?.[0].name).toBe('A');
  });

  it('replace makes the route go up and refreshes the detail', async () => {
    const a = await createRouteActions(client).create({
      ...sampleCreated(),
      name: 'A',
      now: 1000,
    });
    const { actions, hook } = await setup(a);
    await actions.create({ ...sampleCreated(), name: 'B', now: 2000 });
    await waitFor(() =>
      expect(hook.result.current.list.data?.[0].name).toBe('B'),
    );
    const s = sampleCreated();
    await act(async () => {
      await actions.replace(a, {
        draft: s.draft,
        legs: s.legs,
        zone: s.zone,
        preview: s.preview,
        distanceKm: 42,
        durationS: 1,
        ascentM: null,
        descentM: null,
        figuresAt: null,
        savedAt: 9000,
      });
    });
    await waitFor(() =>
      expect(hook.result.current.list.data?.[0].name).toBe('A'),
    );
    await waitFor(() =>
      expect(hook.result.current.detail.data?.distanceKm).toBe(42),
    );
  });

  it('remove: gone from list, detail becomes null, count decreases', async () => {
    const { actions, hook } = await setup();
    const id = await actions.create({ ...sampleCreated(), name: 'A' });
    const keep = await actions.create({ ...sampleCreated(), name: 'B' });
    await waitFor(() => expect(hook.result.current.list.data).toHaveLength(2));
    await waitFor(() => expect(hook.result.current.count.data).toBe(2));
    await act(async () => {
      expect(await actions.remove(id)).toBe(true);
    });
    await waitFor(() =>
      expect(hook.result.current.list.data?.map((r) => r.id)).toEqual([keep]),
    );
    await waitFor(() => expect(hook.result.current.count.data).toBe(1));
    const d = await renderHook(() => useSavedRoute(id), { wrapper });
    await waitFor(() => expect(d.result.current.data).toBeNull());
  });

  it('updateFigures refreshes the list', async () => {
    const { actions, hook } = await setup();
    const id = await actions.create({ ...sampleCreated(), name: 'A' });
    await waitFor(() => expect(hook.result.current.list.data).toHaveLength(1));
    await act(async () => {
      await actions.updateFigures(id, 120, 80, 5000);
    });
    await waitFor(() =>
      expect(hook.result.current.list.data?.[0]).toMatchObject({
        ascentM: 120,
        descentM: 80,
        figuresAt: 5000,
      }),
    );
  });
});
