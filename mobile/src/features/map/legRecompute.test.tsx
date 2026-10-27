// Recalculation by leg (ADR 0016, sections 3 to 5): C2, C3, C5, C12.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-store';
import { act, renderHook } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';

import {
  createRoutingEngine,
  type NativeRouting,
  type RoutingEngine,
} from '@/core/routing/routingEngine';
import type { Zone } from '@/core/zones/catalogue';

import { createDraftStore } from './draftStore';
import { useDragPreview } from './useDragPreview';
import { useLegResults } from './useLegResults';

let mockEngine: RoutingEngine;
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: (points: unknown[], signal?: AbortSignal) =>
    mockEngine.route(points as { lon: number; lat: number }[], signal),
}));

const ZONE: Zone = {
  id: 'z',
  name: 'z',
  version: 1,
  bbox: { lonMin: 5.9, latMin: 48.5, lonMax: 6.4, latMax: 48.9 },
  osmDate: '2026-01-01T00:00:00Z',
  totalBytes: 1,
  files: [],
};

const SHAPE = '_l`y{Aw~ksJoul@gwkA';

type Request = { locations: { lon: number; lat: number }[] };
type Deferred = { resolve: (text: string) => void };

let requests: Request[];
let behaviour: 'ok' | 'fail' | '171' | 'manual';
let pending: Deferred[];

const native: NativeRouting = {
  open: async () => undefined,
  close: async () => undefined,
  route(json) {
    requests.push(JSON.parse(json) as Request);
    if (behaviour === 'fail') return Promise.reject(new Error('boom'));
    if (behaviour === '171') return Promise.resolve('{"code":171}');
    const answer = () =>
      JSON.stringify({
        trip: {
          summary: { length: requests.length, time: 600 },
          legs: [{ shape: SHAPE }],
        },
      });
    if (behaviour === 'manual') {
      return new Promise<string>((resolve) =>
        pending.push({ resolve: () => resolve(answer()) }),
      );
    }
    return Promise.resolve(answer());
  },
};

function useHarness() {
  const [draftStore] = useState(createDraftStore);
  const { store, dispatch } = draftStore;
  const draft = useStore(store, (s) => s.draft);
  const legs = useLegResults(draft, ZONE);
  const drag = useDragPreview(
    () => store.state.draft,
    (id, lon, lat) => dispatch({ type: 'move', id, lon, lat }),
  );
  return { dispatch, draft, legs, ...drag };
}

async function flush(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function setup() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(useHarness, { wrapper });
  await flush();
  return hook;
}

const P = [
  { lon: 6.0, lat: 48.6 },
  { lon: 6.1, lat: 48.65 },
  { lon: 6.2, lat: 48.7 },
  { lon: 6.3, lat: 48.75 },
];

async function addPoints(
  hook: Awaited<ReturnType<typeof setup>>,
  count: number,
) {
  for (const p of P.slice(0, count)) {
    await act(async () => hook.result.current.dispatch({ type: 'add', ...p }));
    await flush();
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  requests = [];
  pending = [];
  behaviour = 'ok';
  mockEngine = createRoutingEngine(native, () => ({
    tarPath: '/t',
    elevationDir: '/e',
  }));
  mockEngine.setZone(ZONE);
});
afterEach(() => jest.useRealTimers());

describe('one calculation per changed leg', () => {
  it('C2: adding a point computes one leg', async () => {
    const hook = await setup();
    await addPoints(hook, 2);
    expect(requests).toHaveLength(1);
    await act(async () =>
      hook.result.current.dispatch({ type: 'add', ...P[2]! }),
    );
    await flush();
    expect(requests).toHaveLength(2);
    expect(hook.result.current.legs.map((l) => l.status)).toEqual([
      'done',
      'done',
    ]);
  });

  it('C2: moving a middle point computes 2 legs, removing computes 1', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    expect(requests).toHaveLength(3);
    const id = hook.result.current.draft.points[1]!.id;
    await act(async () =>
      hook.result.current.dispatch({ type: 'move', id, lon: 6.12, lat: 48.66 }),
    );
    await flush();
    expect(requests).toHaveLength(5);
    await act(async () => hook.result.current.dispatch({ type: 'remove', id }));
    await flush();
    expect(requests).toHaveLength(6);
  });

  it('C5: undo computes nothing (cache)', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    const id = hook.result.current.draft.points[1]!.id;
    await act(async () => hook.result.current.dispatch({ type: 'remove', id }));
    await flush();
    const before = requests.length;
    await act(async () => hook.result.current.dispatch({ type: 'undo' }));
    await flush();
    expect(requests).toHaveLength(before);
    expect(hook.result.current.legs).toHaveLength(3);
    expect(hook.result.current.legs.every((l) => l.status === 'done')).toBe(
      true,
    );
  });

  it('C5: a leg undone before its answer makes no native call', async () => {
    behaviour = 'manual';
    const hook = await setup();
    await addPoints(hook, 3); // leg 0 is in the engine, leg 1 waits in line
    expect(requests).toHaveLength(1);
    await act(async () => hook.result.current.dispatch({ type: 'undo' }));
    await flush();
    await act(async () => pending[0]!.resolve(''));
    await flush();
    expect(requests).toHaveLength(1);
  });

  it('a "hand" leg does not call the engine', async () => {
    const hook = await setup();
    await act(async () =>
      hook.result.current.dispatch({ type: 'chooseMode', mode: 'hand' }),
    );
    await addPoints(hook, 2);
    expect(requests).toHaveLength(0);
    expect(hook.result.current.legs[0]?.status).toBe('hand');
  });
});

describe('errors', () => {
  it('code 171 gives farFromPath', async () => {
    behaviour = '171';
    const hook = await setup();
    await addPoints(hook, 2);
    expect(hook.result.current.legs[0]).toEqual({
      status: 'error',
      error: 'farFromPath',
    });
    expect(requests[0]?.locations[0]).toHaveProperty('search_cutoff', 200);
  });

  it('a point outside the zone gives outOfZone without engine call', async () => {
    const hook = await setup();
    await act(async () =>
      hook.result.current.dispatch({ type: 'add', ...P[0]! }),
    );
    await act(async () =>
      hook.result.current.dispatch({ type: 'add', lon: 2, lat: 40 }),
    );
    await flush();
    expect(requests).toHaveLength(0);
    expect(hook.result.current.legs[0]).toEqual({
      status: 'error',
      error: 'outOfZone',
    });
  });
});

describe('drag', () => {
  async function dragTwoSeconds(
    hook: Awaited<ReturnType<typeof setup>>,
    id: number,
  ) {
    let last = P[1]!;
    for (let t = 0; t < 2000; t += 16) {
      last = { lon: 6.1 + t * 1e-5, lat: 48.65 + t * 1e-5 };
      await act(async () => hook.result.current.drag(id, last.lon, last.lat));
      await flush(16);
    }
    return last;
  }

  it('C3: at most 5 calculations per second, final one at the end position', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    const initial = requests.length;
    const id = hook.result.current.draft.points[1]!.id;
    const last = await dragTwoSeconds(hook, id);
    await flush(300);
    const calculations = (requests.length - initial) / 2; // 2 legs each
    expect(calculations).toBeGreaterThanOrEqual(8);
    expect(calculations).toBeLessThanOrEqual(11);

    const duringDrag = requests.length;
    await act(async () =>
      hook.result.current.release(id, last.lon + 1e-4, last.lat),
    );
    await flush(500);
    // Final calculation: the two neighbour legs, at the end event position.
    expect(requests.length).toBe(duringDrag + 2);
    for (const request of requests.slice(-2)) {
      expect(request.locations.some((l) => l.lon === last.lon + 1e-4)).toBe(
        true,
      );
    }
    // The leg 3 -> 4 was computed once, at the start.
    const far = requests.filter((r) =>
      r.locations.some((l) => l.lon === P[3]!.lon && l.lat === P[3]!.lat),
    );
    expect(far.filter((r) => r.locations[0]?.lon === P[2]!.lon)).toHaveLength(
      1,
    );
    expect(hook.result.current.draft.points[1]?.lon).toBe(last.lon + 1e-4);
  });

  it('C12: a failure during the gesture keeps the old line', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = hook.result.current.draft.points[1]!.id;
    await act(async () => hook.result.current.drag(id, 6.11, 48.66));
    await flush(10);
    const kept = hook.result.current.preview[0];
    expect(kept).toBeDefined();
    behaviour = 'fail';
    await flush(200);
    await act(async () => hook.result.current.drag(id, 6.13, 48.67));
    await flush(300);
    expect(hook.result.current.preview[0]).toBe(kept);
  });

  it('C12: a failure at release is the error of the legs', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = hook.result.current.draft.points[1]!.id;
    behaviour = 'fail';
    await act(async () => hook.result.current.drag(id, 6.11, 48.66));
    await flush(300);
    await act(async () => hook.result.current.release(id, 6.12, 48.67));
    await flush(100);
    expect(hook.result.current.legs.map((l) => l.status)).toEqual([
      'error',
      'error',
    ]);
  });
});
