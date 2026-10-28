// Tests written from the spec of phase 4 (C2, C3, C5, C8, C12) and from
// ADR 0016 sections 3 to 5, not from the code. The engine is real; only its
// native module is faked (it counts the calls). The clock is fake.
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
const ANSWER = JSON.stringify({
  trip: { summary: { length: 5.9, time: 1200 }, legs: [{ shape: SHAPE }] },
});

type Loc = { lon: number; lat: number; type: string; search_cutoff?: number };
type Call = { locations: Loc[]; at: number };

let calls: Call[];
// 'auto' answers at once; 'manual' waits for the test; the others refuse.
let mode: 'auto' | 'manual' | 'reject' | '171-ios' | '171-android';
let waiting: ((text: string) => void)[];
let unhandled: jest.Mock;

const native: NativeRouting = {
  open: async () => undefined,
  close: async () => undefined,
  route(json) {
    calls.push({
      ...(JSON.parse(json) as { locations: Loc[] }),
      at: Date.now(),
    });
    if (mode === 'reject') return Promise.reject(new Error('boom'));
    if (mode === '171-ios') {
      return Promise.resolve(
        '{ "message": "No suitable edges near location", "code": 171 }',
      );
    }
    if (mode === '171-android') {
      // Same text as src/core/routing/fixtures/android-171.json.
      return Promise.resolve(
        '{"code":171,"message":"ValhallaError(code=171, No suitable edges near location)"}',
      );
    }
    if (mode === 'manual') {
      return new Promise<string>((resolve) => waiting.push(resolve));
    }
    return Promise.resolve(ANSWER);
  },
};

function useHarness({ version }: { version: number }) {
  const [draftStore] = useState(createDraftStore);
  const { store, dispatch } = draftStore;
  const draft = useStore(store, (s) => s.draft);
  const legs = useLegResults(draft, { id: 'z', version });
  const drag = useDragPreview(
    () => store.state.draft,
    (id, lon, lat) => dispatch({ type: 'move', id, lon, lat }),
  );
  return { dispatch, draft, legs, ...drag };
}

type Hook = Awaited<ReturnType<typeof setup>>;

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
  const hook = await renderHook(useHarness, {
    wrapper,
    initialProps: { version: 1 },
  });
  await flush();
  return hook;
}

const P = [
  { lon: 6.0, lat: 48.6 },
  { lon: 6.1, lat: 48.65 },
  { lon: 6.2, lat: 48.7 },
  { lon: 6.3, lat: 48.75 },
];

async function addPoints(hook: Hook, count: number) {
  for (const p of P.slice(0, count)) {
    await act(async () => hook.result.current.dispatch({ type: 'add', ...p }));
    await flush();
  }
}

const idOf = (hook: Hook, index: number) =>
  hook.result.current.draft.points[index]!.id;

/** Resolve every native call that waits, until none is left. */
async function answerAll() {
  for (let guard = 0; guard < 20; guard += 1) {
    const next = waiting.shift();
    if (!next) break;
    await act(async () => next(ANSWER));
    await flush();
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  calls = [];
  waiting = [];
  mode = 'auto';
  unhandled = jest.fn();
  process.on('unhandledRejection', unhandled);
  mockEngine = createRoutingEngine(native, () => ({
    tarPath: '/t',
    elevationDir: '/e',
  }));
  mockEngine.setZone(ZONE);
});

afterEach(async () => {
  jest.useRealTimers();
  await new Promise((resolve) => setTimeout(resolve, 10));
  process.off('unhandledRejection', unhandled);
  expect(unhandled).not.toHaveBeenCalled();
});

describe('C2: only the changed legs are computed', () => {
  it('adding a point: 1 calculation per added point', async () => {
    const hook = await setup();
    await addPoints(hook, 2);
    expect(calls).toHaveLength(1);
    await addPoints(hook, 0);
    await act(async () =>
      hook.result.current.dispatch({ type: 'add', ...P[2]! }),
    );
    await flush();
    expect(calls).toHaveLength(2);
    await act(async () =>
      hook.result.current.dispatch({ type: 'add', ...P[3]! }),
    );
    await flush();
    expect(calls).toHaveLength(3);
  });

  it('moving a middle point: 2 calculations', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    const before = calls.length;
    await act(async () =>
      hook.result.current.dispatch({
        type: 'move',
        id: idOf(hook, 1),
        lon: 6.12,
        lat: 48.66,
      }),
    );
    await flush();
    expect(calls.length - before).toBe(2);
  });

  it('removing a middle point: 1 calculation (the new leg)', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    const before = calls.length;
    await act(async () =>
      hook.result.current.dispatch({ type: 'remove', id: idOf(hook, 1) }),
    );
    await flush();
    expect(calls.length - before).toBe(1);
  });

  it('a "by hand" leg: 0 calculation, even when changed', async () => {
    const hook = await setup();
    await act(async () =>
      hook.result.current.dispatch({ type: 'chooseMode', mode: 'hand' }),
    );
    await addPoints(hook, 3);
    expect(calls).toHaveLength(0);
    await act(async () =>
      hook.result.current.dispatch({
        type: 'move',
        id: idOf(hook, 1),
        lon: 6.12,
        lat: 48.66,
      }),
    );
    await flush();
    expect(calls).toHaveLength(0);
    expect(hook.result.current.legs.map((l) => l.status)).toEqual([
      'hand',
      'hand',
    ]);
  });

  it('switching a computed leg to "by hand": 0 calculation', async () => {
    const hook = await setup();
    await addPoints(hook, 2);
    const before = calls.length;
    await act(async () =>
      hook.result.current.dispatch({
        type: 'setLegMode',
        indices: [0],
        mode: 'hand',
      }),
    );
    await flush();
    expect(calls).toHaveLength(before);
    expect(hook.result.current.legs[0]?.status).toBe('hand');
  });
});

describe('C5: undo does not compute again', () => {
  it('undo after several actions: 0 calculation', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    const id = idOf(hook, 1);
    await act(async () =>
      hook.result.current.dispatch({ type: 'move', id, lon: 6.12, lat: 48.66 }),
    );
    await flush();
    await act(async () => hook.result.current.dispatch({ type: 'remove', id }));
    await flush();
    await act(async () =>
      hook.result.current.dispatch({ type: 'add', lon: 6.35, lat: 48.8 }),
    );
    await flush();
    const before = calls.length;
    for (let i = 0; i < 3; i += 1) {
      await act(async () => hook.result.current.dispatch({ type: 'undo' }));
      await flush();
    }
    expect(calls).toHaveLength(before);
    expect(hook.result.current.draft.points).toHaveLength(4);
    expect(hook.result.current.legs.map((l) => l.status)).toEqual([
      'done',
      'done',
      'done',
    ]);
  });

  it('undo of a drag release: 0 calculation', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = idOf(hook, 1);
    await act(async () => hook.result.current.drag(id, 6.11, 48.66));
    await flush(300);
    await act(async () => hook.result.current.release(id, 6.12, 48.67));
    await flush(300);
    const before = calls.length;
    await act(async () => hook.result.current.dispatch({ type: 'undo' }));
    await flush(300);
    expect(calls).toHaveLength(before);
    expect(hook.result.current.draft.points[1]?.lon).toBe(P[1]!.lon);
  });

  it('a new zone version computes again (key holds the version)', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const before = calls.length;
    await hook.rerender({ version: 1 });
    await flush();
    expect(calls).toHaveLength(before);
    await hook.rerender({ version: 2 });
    await flush();
    expect(calls.length - before).toBe(2);
  });
});

describe('C3: the gesture', () => {
  async function dragTwoSeconds(hook: Hook, id: number) {
    let last = P[1]!;
    for (let t = 0; t < 2000; t += 16) {
      last = { lon: 6.1 + t * 1e-5, lat: 48.65 + t * 1e-5 };
      await act(async () => hook.result.current.drag(id, last.lon, last.lat));
      await flush(16);
    }
    return last;
  }

  it('at most 5 calculations per second, 200 ms between two of a leg', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    const initial = calls.length;
    await dragTwoSeconds(hook, idOf(hook, 1));
    await flush(300);
    // Leg 0 is P0 -> moving point: first location is P0.
    const leg0 = calls
      .slice(initial)
      .filter((c) => c.locations[0]!.lon === P[0]!.lon)
      .map((c) => c.at);
    expect(leg0.length).toBeGreaterThan(5); // the throttle did run
    for (let i = 1; i < leg0.length; i += 1) {
      expect(leg0[i]! - leg0[i - 1]!).toBeGreaterThanOrEqual(200);
    }
    for (const start of leg0) {
      const inWindow = leg0.filter((t) => t >= start && t < start + 1000);
      expect(inWindow.length).toBeLessThanOrEqual(5);
    }
    // 2 s of gesture: not far below the maximum either.
    expect(leg0.length).toBeLessThanOrEqual(11);
  });

  it('final calculation at the end position; the other legs do not move', async () => {
    const hook = await setup();
    await addPoints(hook, 4);
    const id = idOf(hook, 1);
    const last = await dragTwoSeconds(hook, id);
    await flush(300);
    const end = { lon: last.lon + 1e-4, lat: last.lat };
    const before = calls.length;
    await act(async () => hook.result.current.release(id, end.lon, end.lat));
    await flush(500);
    const final = calls.slice(before);
    expect(final).toHaveLength(2);
    for (const c of final) {
      expect(
        c.locations.some((l) => l.lon === end.lon && l.lat === end.lat),
      ).toBe(true);
    }
    expect(hook.result.current.draft.points[1]).toMatchObject(end);
    // Leg P2 -> P3 was computed once, at the start, never during the gesture.
    const far = calls.filter(
      (c) =>
        c.locations[0]!.lon === P[2]!.lon && c.locations[1]!.lon === P[3]!.lon,
    );
    expect(far).toHaveLength(1);
    // No call during the gesture touches P3 except the leg P2 -> P3 itself.
    expect(
      calls.filter((c) => c.locations.some((l) => l.lon === P[3]!.lon)),
    ).toHaveLength(1);
  });

  it('race: an answer of the gesture arriving after release() does not change the preview', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = idOf(hook, 1);
    mode = 'manual';
    await act(async () => hook.result.current.drag(id, 6.11, 48.66));
    await flush(10);
    expect(waiting).toHaveLength(1); // leg 0 in the engine, leg 1 in line
    await act(async () => hook.result.current.release(id, 6.12, 48.67));
    await flush(10);
    await act(async () => waiting.shift()!(ANSWER)); // the old answer comes
    await flush(10);
    expect(hook.result.current.preview).toEqual({});
    await answerAll();
  });

  it('race: release() while the end-of-window calculation waits makes no extra call', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = idOf(hook, 1);
    await act(async () => hook.result.current.drag(id, 6.11, 48.66)); // leading
    await flush(50);
    await act(async () => hook.result.current.drag(id, 6.15, 48.69)); // trailing waits
    await flush(10);
    const before = calls.length;
    await act(async () => hook.result.current.release(id, 6.12, 48.67));
    await flush(1000);
    // Only the 2 legs of the final calculation; nothing at 6.15 (the trailing).
    expect(calls.length - before).toBe(2);
    expect(calls.some((c) => c.locations.some((l) => l.lon === 6.15))).toBe(
      false,
    );
  });

  it('race: the second neighbour of a replaced calculation makes no native call', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = idOf(hook, 1);
    mode = 'manual';
    await act(async () => hook.result.current.drag(id, 6.11, 48.66)); // A
    await flush(100);
    await act(async () => hook.result.current.drag(id, 6.13, 48.68)); // saved
    await flush(150); // trailing at 200 ms: B replaces A
    // A: leg 0 in the engine, leg 1 was in line behind it and is now aborted.
    expect(
      calls.filter((c) => c.locations.some((l) => l.lon === 6.11)),
    ).toHaveLength(1);
    await answerAll();
    expect(
      calls.filter((c) => c.locations.some((l) => l.lon === 6.11)),
    ).toHaveLength(1);
    expect(
      calls.filter((c) => c.locations.some((l) => l.lon === 6.13)),
    ).toHaveLength(2);
  });
});

describe('C12: never a crash', () => {
  it('a failure during the gesture keeps the old line', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = idOf(hook, 1);
    await act(async () => hook.result.current.drag(id, 6.11, 48.66));
    await flush(10);
    const kept = hook.result.current.preview[0];
    expect(kept?.ok).toBe(true);
    mode = 'reject';
    await flush(200);
    await act(async () => hook.result.current.drag(id, 6.13, 48.67));
    await flush(300);
    expect(calls.length).toBeGreaterThan(3); // the failing calls did happen
    expect(hook.result.current.preview[0]).toBe(kept);
  });

  it('an engine that rejects (against its contract) does not crash the gesture', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    mockEngine = { ...mockEngine, route: () => Promise.reject(new Error('x')) };
    const id = idOf(hook, 1);
    await act(async () => hook.result.current.drag(id, 6.11, 48.66));
    await flush(300);
    expect(hook.result.current.preview).toEqual({});
  });

  it('a failure at release gives the error on both legs, and keeps the last preview', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    const id = idOf(hook, 1);
    await act(async () => hook.result.current.drag(id, 6.11, 48.66));
    await flush(10);
    const kept = hook.result.current.preview[0];
    expect(kept).toBeDefined();
    mode = 'reject';
    await act(async () => hook.result.current.release(id, 6.12, 48.67));
    await flush(100);
    expect(hook.result.current.legs).toEqual([
      { status: 'error', error: 'failed' },
      { status: 'error', error: 'failed' },
    ]);
    expect(hook.result.current.preview[0]).toBe(kept);
  });

  it('a failure on adding a point shows an error state, no rejection', async () => {
    const hook = await setup();
    mode = 'reject';
    await addPoints(hook, 2);
    expect(hook.result.current.legs[0]).toEqual({
      status: 'error',
      error: 'failed',
    });
  });

  it('an engine that rejects makes the leg fail, not the screen', async () => {
    const hook = await setup();
    mockEngine = { ...mockEngine, route: () => Promise.reject(new Error('x')) };
    await addPoints(hook, 2);
    expect(hook.result.current.legs[0]?.status).toBe('error');
  });
});

describe('C8: 200 m from a path', () => {
  it('every location carries search_cutoff: 200', async () => {
    const hook = await setup();
    await addPoints(hook, 3);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.locations).toHaveLength(2);
      for (const loc of call.locations) expect(loc.search_cutoff).toBe(200);
    }
  });

  it.each(['171-ios', '171-android'] as const)(
    'code 171 (%s) gives farFromPath, not outOfZone',
    async (kind) => {
      mode = kind;
      const hook = await setup();
      await addPoints(hook, 2);
      expect(hook.result.current.legs[0]).toEqual({
        status: 'error',
        error: 'farFromPath',
      });
    },
  );

  it('a point outside the zone rectangle is outOfZone, with no native call', async () => {
    const hook = await setup();
    await addPoints(hook, 1);
    await act(async () =>
      hook.result.current.dispatch({ type: 'add', lon: 2.35, lat: 48.85 }),
    );
    await flush();
    expect(calls).toHaveLength(0);
    expect(hook.result.current.legs[0]).toEqual({
      status: 'error',
      error: 'outOfZone',
    });
  });
});
