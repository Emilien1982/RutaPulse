// Infos by leg (ADR 0017, section 6): keys, activation, no call during a
// drag, no failure in the cache, "undo" without any call (C4, C6, C9, C10).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-store';
import { act, renderHook } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';

import { failure } from '@/core/routing/routeResponse';
import { summarizeInfo } from '@/core/route-info/routeInfo';
import type { Zone } from '@/core/zones/catalogue';

import { createDraftStore } from './draftStore';
import { useDragPreview } from './useDragPreview';
import { useLegInfos } from './useLegInfos';
import { useLegResults } from './useLegResults';

const mockRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: (...args: unknown[]) => mockRoute(...args),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: (...args: unknown[]) => mockHeights(...args),
  computeTerrain: (...args: unknown[]) => mockTerrain(...args),
}));

const ZONE: Zone = {
  id: 'z',
  name: 'z',
  version: 2,
  bbox: { lonMin: 5.9, latMin: 48.5, lonMax: 6.4, latMax: 48.9 },
  osmDate: '2026-01-01T00:00:00Z',
  totalBytes: 1,
  files: [],
};

const A: [number, number] = [6.1, 48.66];
const B: [number, number] = [6.14, 48.68];
const C: [number, number] = [6.18, 48.7];
const OUT: [number, number] = [7.5, 48.7];

const ROUTE = {
  ok: true,
  shape: [
    [6.1, 48.66],
    [6.14, 48.68],
  ],
  distanceKm: 2,
  durationS: 600,
};
const PROFILE = {
  ok: true,
  profile: [
    [0, 200],
    [30, 210],
    [60, 220],
  ],
};
const EDGES = {
  ok: true,
  edges: [{ use: 'track', density: 0, lengthKm: 2 }],
};

function useHarness() {
  const [draftStore] = useState(createDraftStore);
  const { store, dispatch } = draftStore;
  const draft = useStore(store, (s) => s.draft);
  const legs = useLegResults(draft, ZONE);
  const infos = useLegInfos(draft, ZONE, legs);
  const drag = useDragPreview(
    () => store.state.draft,
    (id, lon, lat) => dispatch({ type: 'move', id, lon, lat }),
  );
  return { dispatch, draft, infos, info: summarizeInfo(infos), ...drag };
}

let client: QueryClient;
async function setup() {
  client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return await renderHook(useHarness, { wrapper });
}

async function flush(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

type Harness = Awaited<ReturnType<typeof setup>>;
async function add(h: Harness, ...points: [number, number][]) {
  for (const [lon, lat] of points) {
    await act(async () => h.result.current.dispatch({ type: 'add', lon, lat }));
    await flush();
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRoute.mockResolvedValue(ROUTE);
  mockHeights.mockResolvedValue(PROFILE);
  mockTerrain.mockResolvedValue(EDGES);
});
afterEach(() => jest.useRealTimers());

describe('keys and activation', () => {
  it('a path leg has a height key and a terrain key, with the zone version', async () => {
    const h = await setup();
    await add(h, A, B);
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .filter((k) => k[1] !== 'leg');
    expect(keys).toEqual([
      ['routing', 'height', 'z', 2, 'path', A[0], A[1], B[0], B[1]],
      ['routing', 'terrain', 'z', 2, 'path', A[0], A[1], B[0], B[1]],
    ]);
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(mockTerrain).toHaveBeenCalledTimes(1);
    expect(mockHeights.mock.calls[0]?.[0]).toEqual(ROUTE.shape);
    expect(h.result.current.info.altitudes.status).toBe('ready');
  });

  it('nothing runs while the route is unknown: pending, not failed', async () => {
    mockRoute.mockReturnValue(new Promise(() => undefined));
    const h = await setup();
    await add(h, A, B);
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
    expect(h.result.current.info.altitudes.status).toBe('pending');
  });

  it('a hand leg runs at once on the straight line, with no terrain request', async () => {
    mockRoute.mockReturnValue(new Promise(() => undefined));
    const h = await setup();
    await act(async () =>
      h.result.current.dispatch({ type: 'chooseMode', mode: 'hand' }),
    );
    await add(h, A, B);
    expect(mockRoute).not.toHaveBeenCalled();
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(mockHeights.mock.calls[0]?.[0]).toEqual([A, B]);
    expect(mockTerrain).not.toHaveBeenCalled();
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(keys).toEqual([
      ['routing', 'height', 'z', 2, 'hand', A[0], A[1], B[0], B[1]],
    ]);
  });
});

describe('missing data', () => {
  it('a failed route gives missing altitudes, not "pending"', async () => {
    mockRoute.mockResolvedValue(failure('noRoute'));
    const h = await setup();
    await add(h, A, B);
    expect(mockHeights).not.toHaveBeenCalled();
    expect(h.result.current.infos[0]?.height).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(h.result.current.info.altitudes.status).toBe('missing');
  });

  it('a hand leg outside the zone rectangle gives missing altitudes, with no call', async () => {
    const h = await setup();
    await act(async () =>
      h.result.current.dispatch({ type: 'chooseMode', mode: 'hand' }),
    );
    await add(h, A, OUT);
    expect(mockHeights).not.toHaveBeenCalled();
    expect(h.result.current.info.altitudes.status).toBe('missing');
  });

  it('a failure is never kept in the cache; the altitudes stay if the terrain fails', async () => {
    mockTerrain.mockResolvedValue(failure('failed'));
    const h = await setup();
    await add(h, A, B);
    const infoKeys = client
      .getQueryCache()
      .getAll()
      .filter((q) => q.queryKey[1] === 'height' || q.queryKey[1] === 'terrain');
    expect(infoKeys.map((q) => q.state.status)).toEqual(['success', 'error']);
    expect(infoKeys.every((q) => q.state.data !== 'failed')).toBe(true);
    expect(h.result.current.info.altitudes.status).toBe('ready');
    expect(h.result.current.info.terrain.status).toBe('missing');
  });
});

describe('no call during a drag, none on undo', () => {
  it('a drag computes no info; the release computes the two legs', async () => {
    const h = await setup();
    await add(h, A, B, C);
    expect(mockHeights).toHaveBeenCalledTimes(2);
    mockHeights.mockClear();
    mockTerrain.mockClear();
    const id = h.result.current.draft.points[1]?.id as number;
    for (let i = 1; i <= 5; i++) {
      await act(async () => h.result.current.drag(id, B[0] + i * 0.001, B[1]));
      await flush(150);
    }
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
    await act(async () => h.result.current.release(id, B[0] + 0.01, B[1]));
    await flush();
    expect(mockHeights).toHaveBeenCalledTimes(2);
    expect(mockTerrain).toHaveBeenCalledTimes(2);
  });

  it('undo finds everything in the cache: no native call', async () => {
    const h = await setup();
    await add(h, A, B, C);
    const id = h.result.current.draft.points[1]?.id as number;
    await act(async () => h.result.current.release(id, B[0] + 0.01, B[1]));
    await flush();
    jest.clearAllMocks();
    await act(async () => h.result.current.dispatch({ type: 'undo' }));
    await flush();
    expect(mockRoute).not.toHaveBeenCalled();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
    expect(h.result.current.info.altitudes.status).toBe('ready');
  });
});
