import android171 from './fixtures/android-171.json';
import android442 from './fixtures/android-442.json';
import androidNotOpen from './fixtures/android-not-open.json';
import androidSuccess from './fixtures/android-success.json';
import androidUnreadable from './fixtures/android-zone-unreadable.json';
import ios171 from './fixtures/ios-171.json';
import ios442 from './fixtures/ios-442.json';
import iosNotOpen from './fixtures/ios-not-open.json';
import iosSuccess from './fixtures/ios-success.json';
import iosUnreadable from './fixtures/ios-zone-unreadable.json';
import type { Zone } from '../zones/catalogue';
import { buildRouteRequest } from './routeRequest';
import {
  kindFromNativeError,
  parseRouteResponse,
  type RouteResult,
} from './routeResponse';
import { createRoutingEngine, type NativeRouting } from './routingEngine';

const files: Record<string, any> = {
  'android-171.json': android171,
  'android-442.json': android442,
  'android-not-open.json': androidNotOpen,
  'android-success.json': androidSuccess,
  'android-zone-unreadable.json': androidUnreadable,
  'ios-171.json': ios171,
  'ios-442.json': ios442,
  'ios-not-open.json': iosNotOpen,
  'ios-success.json': iosSuccess,
  'ios-zone-unreadable.json': iosUnreadable,
};
function fixture(name: string): any {
  return files[name];
}
function text(name: string): string {
  return JSON.stringify(files[name]);
}

const HAYE = { lat: 48.6612, lon: 6.1015 };
const NANCY = { lat: 48.6846, lon: 6.1408 };

function zone(id: string, version = 1): Zone {
  return {
    id,
    version,
    bbox: { lonMin: 5.9, latMin: 48.5, lonMax: 6.3, latMax: 48.8 },
  } as Zone;
}

describe('buildRouteRequest', () => {
  it('sets the bicycle options and the point types', () => {
    const req = JSON.parse(
      buildRouteRequest([HAYE, { lat: 48.67, lon: 6.12 }, NANCY]),
    );
    expect(req.costing).toBe('bicycle');
    expect(req.costing_options.bicycle).toEqual({
      bicycle_type: 'mountain',
      use_roads: 0,
    });
    expect(req.directions_options).toEqual({
      language: 'fr-FR',
      units: 'kilometers',
    });
    expect(req.locations.map((l: any) => l.type)).toEqual([
      'break',
      'through',
      'break',
    ]);
    expect(req.locations[0]).toMatchObject(HAYE);
  });
});

describe('parseRouteResponse with real outputs', () => {
  it.each(['ios-success.json', 'android-success.json'])('reads %s', (name) => {
    const r = parseRouteResponse(text(name));
    if (!r.ok) throw new Error('expected success');
    // Values from the T1 trial: 5.918 km, start near Forêt de Haye.
    expect(r.distanceKm).toBe(5.918);
    expect(r.durationS).toBeCloseTo(1253.829, 3);
    expect(r.shape[0][0]).toBeCloseTo(HAYE.lon, 3);
    expect(r.shape[0][1]).toBeCloseTo(HAYE.lat, 3);
    const end = r.shape[r.shape.length - 1];
    expect(end[0]).toBeCloseTo(NANCY.lon, 3);
    expect(end[1]).toBeCloseTo(NANCY.lat, 3);
  });

  it.each([
    ['ios-171.json', 'outOfZone'],
    ['android-171.json', 'outOfZone'],
    ['ios-442.json', 'noRoute'],
    ['android-442.json', 'noRoute'],
  ])('reads the refusal %s', (name, error) => {
    expect(parseRouteResponse(text(name))).toEqual({ ok: false, error });
  });

  it('turns garbage into failed', () => {
    for (const bad of ['', 'nope', '[]', '{}', '{"trip":{}}', '{"code":9}']) {
      expect(parseRouteResponse(bad)).toEqual({ ok: false, error: 'failed' });
    }
  });
});

describe('kindFromNativeError with real rejections', () => {
  it.each([
    ['ios-not-open.json', 'engineUnavailable'],
    ['android-not-open.json', 'engineUnavailable'],
    ['ios-zone-unreadable.json', 'zoneUnreadable'],
    ['android-zone-unreadable.json', 'zoneUnreadable'],
  ])('%s', (name, kind) => {
    expect(kindFromNativeError(fixture(name).rejected)).toBe(kind);
  });

  it('maps the rest to failed', () => {
    expect(kindFromNativeError({ code: 'ERR_ENGINE' })).toBe('failed');
    expect(kindFromNativeError(new Error('x'))).toBe('failed');
    expect(kindFromNativeError(null)).toBe('failed');
  });
});

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeNative(overrides: Partial<NativeRouting> = {}) {
  const calls: string[] = [];
  const native: NativeRouting = {
    open: jest.fn(async (tar: string) => void calls.push(`open ${tar}`)),
    close: jest.fn(async () => void calls.push('close')),
    route: jest.fn(async () => {
      calls.push('route');
      return text('ios-success.json');
    }),
    ...overrides,
  };
  const engine = createRoutingEngine(native, (z) => ({
    tarPath: `${z.id}.tar`,
    elevationDir: `${z.id}-elev`,
  }));
  return { native, engine, calls };
}

describe('routing engine', () => {
  it('waits for the opening, then calculates (C2)', async () => {
    const gate = deferred();
    const { engine, calls } = makeNative({
      open: jest.fn(async () => gate.promise),
    });
    engine.setZone(zone('a'));
    expect(engine.getState()).toBe('opening');
    const pending = engine.route([HAYE, NANCY]);
    await Promise.resolve();
    expect(calls).toEqual([]);
    gate.resolve();
    const r = await pending;
    expect(r.ok).toBe(true);
    expect(engine.getState()).toBe('open');
  });

  it('gives the opening error to a waiting call', async () => {
    const { engine } = makeNative({
      open: jest.fn(async () => {
        throw { code: 'ERR_ZONE_UNREADABLE' };
      }),
    });
    engine.setZone(zone('a'));
    const r = await engine.route([HAYE, NANCY]);
    expect(r).toEqual({ ok: false, error: 'zoneUnreadable' });
    expect(engine.getState()).toBe('failed');
  });

  it('has no engine without a zone', async () => {
    const { engine, native } = makeNative();
    expect(await engine.route([HAYE, NANCY])).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
    expect(native.route).not.toHaveBeenCalled();
  });

  it('refuses a point outside the zone before calling the module', async () => {
    const { engine, native } = makeNative();
    engine.setZone(zone('a'));
    const r = await engine.route([HAYE, { lat: 48.8566, lon: 2.3522 }]);
    expect(r).toEqual({ ok: false, error: 'outOfZone' });
    expect(native.route).not.toHaveBeenCalled();
  });

  it('never throws, whatever the module does', async () => {
    const { engine } = makeNative({
      route: jest.fn(async () => {
        throw { code: 'ERR_ENGINE' };
      }),
    });
    engine.setZone(zone('a'));
    expect(await engine.route([HAYE, NANCY])).toEqual({
      ok: false,
      error: 'failed',
    });
  });

  it('finishes a running call on the old zone, then uses the new one', async () => {
    const gate = deferred<string>();
    let first = true;
    const { engine, calls } = makeNative({
      route: jest.fn(async () => {
        calls.push('route');
        if (first) {
          first = false;
          return gate.promise;
        }
        return text('ios-success.json');
      }),
    });
    engine.setZone(zone('a'));
    const r1 = engine.route([HAYE, NANCY]);
    await new Promise((r) => setTimeout(r, 0));
    engine.setZone(zone('b'));
    const r2 = engine.route([HAYE, NANCY]);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(['open a.tar', 'route']);
    gate.resolve(text('ios-success.json'));
    expect((await r1).ok).toBe(true);
    expect(((await r2) as RouteResult).ok).toBe(true);
    expect(calls).toEqual([
      'open a.tar',
      'route',
      'close',
      'open b.tar',
      'route',
    ]);
  });

  it('closes when there is no zone left', async () => {
    const { engine, calls } = makeNative();
    engine.setZone(zone('a'));
    engine.setZone(null);
    expect(await engine.route([HAYE, NANCY])).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
    expect(calls).toEqual(['open a.tar', 'close']);
    expect(engine.getState()).toBe('closed');
  });
});
