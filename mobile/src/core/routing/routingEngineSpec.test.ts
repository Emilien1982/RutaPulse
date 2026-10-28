// Tester tests, written from the spec (C2, C6) and ADR 0015 sections 3 to 5.
import type { Zone } from '../zones/catalogue';
import { createRoutingEngine, type NativeRouting } from './routingEngine';

const SUCCESS = JSON.stringify({
  trip: {
    summary: { length: 5.9, time: 1200 },
    legs: [{ shape: '_l`y{Aw~ksJoul@gwkA' }],
  },
});

function zone(id: string, version = 1): Zone {
  return {
    id,
    name: id,
    version,
    bbox: { lonMin: 5.9, latMin: 48.5, lonMax: 6.4, latMax: 48.9 },
    osmDate: '2026-01-01T00:00:00Z',
    totalBytes: 1,
    files: [],
  };
}
const pathsOf = (z: Zone) => ({
  tarPath: `/docs/${z.id}/v${z.version}/valhalla_tiles.tar`,
  elevationDir: `/docs/${z.id}/v${z.version}/elevation`,
});

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};
function deferred<T = void>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  for (let i = 0; i < 5; i++)
    await new Promise<void>((r) => setImmediate(() => r()));
};

const A = { lat: 48.66, lon: 6.1 };
const B = { lat: 48.68, lon: 6.14 };

function fakeNative() {
  const events: string[] = [];
  const opens: Deferred[] = [];
  const routes: Deferred<string>[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const native: NativeRouting = {
    open: jest.fn((tar: string) => {
      events.push(`open:${tar}`);
      const d = deferred();
      opens.push(d);
      return d.promise;
    }),
    close: jest.fn(async () => {
      events.push('close');
    }),
    route: jest.fn((req: string) => {
      events.push('route');
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const d = deferred<string>();
      routes.push(d);
      return d.promise.finally(() => {
        inFlight--;
      });
    }),
  };
  return { native, events, opens, routes, maxInFlight: () => maxInFlight };
}

describe('routing engine life cycle (C2)', () => {
  it('a route asked during opening waits for the end of opening, then succeeds', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy'));
    const p = engine.route([A, B]);
    await flush();
    expect(f.native.open).toHaveBeenCalledTimes(1);
    expect(f.native.route).not.toHaveBeenCalled();
    (await waitOpen(f, 0)).resolve();
    await flush();
    expect(f.native.route).toHaveBeenCalledTimes(1);
    f.routes[0].resolve(SUCCESS);
    const res = await p;
    expect(res.ok).toBe(true);
    expect(engine.getState()).toBe('open');
  });

  it('opens with the paths of the zone', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy', 3));
    await flush();
    expect(f.native.open).toHaveBeenCalledWith(
      '/docs/nancy/v3/valhalla_tiles.tar',
      '/docs/nancy/v3/elevation',
    );
  });

  it('several routes during opening leave in order, one at a time', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy'));
    const reqs = [0, 1, 2].map((i) =>
      engine.route([{ lat: 48.6 + i * 0.01, lon: 6.1 }, B]),
    );
    await flush();
    expect(f.native.route).not.toHaveBeenCalled();
    (await waitOpen(f, 0)).resolve();
    await flush();
    expect(f.native.route).toHaveBeenCalledTimes(1);
    f.routes[0].resolve(SUCCESS);
    await flush();
    expect(f.native.route).toHaveBeenCalledTimes(2);
    f.routes[1].resolve(SUCCESS);
    await flush();
    expect(f.native.route).toHaveBeenCalledTimes(3);
    f.routes[2].resolve(SUCCESS);
    const results = await Promise.all(reqs);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(f.maxInFlight()).toBe(1);
    const lats = (f.native.route as jest.Mock).mock.calls.map(
      (c) => JSON.parse(c[0]).locations[0].lat,
    );
    expect(lats.map((x: number) => Math.round(x * 100))).toEqual([
      4860, 4861, 4862,
    ]);
  });

  it('open failure: waiting routes get zoneUnreadable', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy'));
    const p1 = engine.route([A, B]);
    const p2 = engine.route([A, B]);
    (await waitOpen(f, 0)).reject({
      code: 'ERR_ZONE_UNREADABLE',
      message: 'absent',
    });
    expect(await p1).toEqual({ ok: false, error: 'zoneUnreadable' });
    expect(await p2).toEqual({ ok: false, error: 'zoneUnreadable' });
    expect(f.native.route).not.toHaveBeenCalled();
    expect(engine.getState()).toBe('failed');
  });

  it('a route after a failed opening still gets the opening error', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy'));
    (await waitOpen(f, 0)).reject({
      code: 'ERR_ZONE_UNREADABLE',
      message: 'x',
    });
    await flush();
    expect(await engine.route([A, B])).toEqual({
      ok: false,
      error: 'zoneUnreadable',
    });
  });

  it('no zone: route is engineUnavailable, native untouched', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    expect(await engine.route([A, B])).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
    expect(f.native.route).not.toHaveBeenCalled();
    expect(engine.getState()).toBe('closed');
  });

  it('zone change during a calculation: it ends on the old zone, next goes to the new one', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('old'));
    (await waitOpen(f, 0)).resolve();
    await flush();
    const p1 = engine.route([A, B]);
    await flush();
    expect(f.native.route).toHaveBeenCalledTimes(1);
    engine.setZone(zone('new'));
    const p2 = engine.route([A, B]);
    await flush();
    // The old calculation is still running: nothing closed or opened yet.
    expect(f.events).toEqual(['open:/docs/old/v1/valhalla_tiles.tar', 'route']);
    f.routes[0].resolve(SUCCESS);
    expect((await p1).ok).toBe(true);
    await flush();
    expect(f.events.slice(2)).toEqual([
      'close',
      'open:/docs/new/v1/valhalla_tiles.tar',
    ]);
    expect(f.native.route).toHaveBeenCalledTimes(1);
    (await waitOpen(f, 1)).resolve();
    await flush();
    expect(f.native.route).toHaveBeenCalledTimes(2);
    f.routes[1].resolve(SUCCESS);
    expect((await p2).ok).toBe(true);
  });

  it('a new version of the same zone reopens the engine', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy', 2));
    (await waitOpen(f, 0)).resolve();
    await flush();
    engine.setZone(zone('nancy', 3));
    await flush();
    expect(f.native.close).toHaveBeenCalledTimes(1);
    expect(f.native.open).toHaveBeenCalledTimes(2);
  });

  it('zone null closes the engine; routes then say engineUnavailable', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy'));
    (await waitOpen(f, 0)).resolve();
    await flush();
    engine.setZone(null);
    await flush();
    expect(f.native.close).toHaveBeenCalledTimes(1);
    expect(engine.getState()).toBe('closed');
    expect(await engine.route([A, B])).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
    expect(f.native.route).not.toHaveBeenCalled();
  });

  it('zone null with nothing open does not call close needlessly or throw', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(null);
    await flush();
    expect(f.native.open).not.toHaveBeenCalled();
    expect(engine.getState()).toBe('closed');
  });

  it('two close setZone calls: ends on the last zone, one engine at a time', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('one'));
    engine.setZone(zone('two'));
    await flush();
    // First opening not finished: the second must wait.
    expect(f.native.open).toHaveBeenCalledTimes(1);
    (await waitOpen(f, 0)).resolve();
    await flush();
    expect(f.events).toEqual([
      'open:/docs/one/v1/valhalla_tiles.tar',
      'close',
      'open:/docs/two/v1/valhalla_tiles.tar',
    ]);
    (await waitOpen(f, 1)).resolve();
    await flush();
    const p = engine.route([A, B]);
    await flush();
    f.routes[0].resolve(SUCCESS);
    expect((await p).ok).toBe(true);
    expect(engine.getState()).toBe('open');
  });

  it('setZone with the same zone twice opens once', async () => {
    const f = fakeNative();
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy'));
    engine.setZone(zone('nancy'));
    await flush();
    expect(f.native.open).toHaveBeenCalledTimes(1);
  });
});

describe('routing engine errors (C6)', () => {
  async function openEngine(routeImpl: (req: string) => Promise<string>) {
    const f = fakeNative();
    (f.native.route as jest.Mock).mockImplementation(routeImpl);
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('nancy'));
    (await waitOpen(f, 0)).resolve();
    await flush();
    return { engine, f };
  }
  const refusal = (code: number) =>
    JSON.stringify({ code, message: 'whatever' });

  it.each([
    // ADR 0016 section 5: code 171 is now farFromPath (before: outOfZone).
    [171, 'farFromPath'],
    [442, 'noRoute'],
    [441, 'noRoute'],
    [170, 'noRoute'],
    [777, 'failed'],
  ])('Valhalla refusal %i -> %s', async (code, kind) => {
    const { engine } = await openEngine(async () => refusal(code));
    expect(await engine.route([A, B])).toEqual({ ok: false, error: kind });
  });

  it.each([
    ['ERR_ENGINE_NOT_OPEN', 'engineUnavailable'],
    ['ERR_ZONE_UNREADABLE', 'zoneUnreadable'],
    ['ERR_ENGINE', 'failed'],
  ])('native rejection %s -> %s', async (code, kind) => {
    const { engine } = await openEngine(() =>
      Promise.reject({ code, message: 'm' }),
    );
    expect(await engine.route([A, B])).toEqual({ ok: false, error: kind });
  });

  it('rejection without code -> failed, no exception', async () => {
    const { engine } = await openEngine(() => Promise.reject(new Error('x')));
    expect(await engine.route([A, B])).toEqual({ ok: false, error: 'failed' });
  });

  it('synchronous throw of the native function -> failed, no exception', async () => {
    const { engine } = await openEngine(() => {
      throw new Error('sync');
    });
    expect(await engine.route([A, B])).toEqual({ ok: false, error: 'failed' });
  });

  it('answer that is not JSON -> failed', async () => {
    const { engine } = await openEngine(async () => 'not json');
    expect(await engine.route([A, B])).toEqual({ ok: false, error: 'failed' });
  });

  it('message text does not change the kind', async () => {
    const e1 = await openEngine(() =>
      Promise.reject({ code: 'ERR_ENGINE', message: 'zone illisible 171' }),
    );
    const e2 = await openEngine(() =>
      Promise.reject({ code: 'ERR_ENGINE', message: 'autre' }),
    );
    expect(await e1.engine.route([A, B])).toEqual(
      await e2.engine.route([A, B]),
    );
  });

  it.each([
    ['start', { lat: 50, lon: 6.1 }, B],
    ['end', A, { lat: 48.68, lon: 3 }],
  ])(
    'point outside the zone rectangle (%s) -> outOfZone, no native call',
    async (_n, p, q) => {
      const { engine, f } = await openEngine(async () => SUCCESS);
      expect(await engine.route([p as any, q as any])).toEqual({
        ok: false,
        error: 'outOfZone',
      });
      expect(f.native.route).not.toHaveBeenCalled();
    },
  );

  it('an intermediate point outside the rectangle -> outOfZone', async () => {
    const { engine } = await openEngine(async () => SUCCESS);
    expect(await engine.route([A, { lat: 10, lon: 10 }, B])).toEqual({
      ok: false,
      error: 'outOfZone',
    });
  });

  it('close() failing during a zone change does not break the next opening', async () => {
    const f = fakeNative();
    (f.native.close as jest.Mock).mockRejectedValue(new Error('gone'));
    const engine = createRoutingEngine(f.native, pathsOf);
    engine.setZone(zone('one'));
    (await waitOpen(f, 0)).resolve();
    await flush();
    engine.setZone(zone('two'));
    await flush();
    (await waitOpen(f, 1)).resolve();
    await flush();
    const p = engine.route([A, B]);
    await flush();
    f.routes[0].resolve(SUCCESS);
    expect((await p).ok).toBe(true);
  });
});

// The engine calls `open` from its queue, one tick after setZone.
async function waitOpen(
  f: { opens: Deferred[] },
  index: number,
): Promise<Deferred> {
  for (let i = 0; i < 20 && !f.opens[index]; i++) await flush();
  return f.opens[index];
}
