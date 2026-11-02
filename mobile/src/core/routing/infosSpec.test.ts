// Tests written from the spec (p05, C1) and ADR 0017 (sections 1, 2, 8), not
// from the code. Complements infos.test.ts without changing it.
import { buildHeightRequest, buildTraceRequest } from './infoRequest';
import { parseHeightResponse, parseTraceResponse } from './infoResponse';
import { createRoutingEngine, type NativeRouting } from './routingEngine';
import { decodePolyline6, encodePolyline6 } from './routeResponse';
import type { Zone } from '../zones/catalogue';

import iosAbHeight from './fixtures/infos/ios-AB-height-resample30-range.json';
import iosAbTrace from './fixtures/infos/ios-AB-trace-walk_or_snap.json';
import iosHandHeight from './fixtures/infos/ios-hand-height-resample30-range.json';
import iosHandTrace from './fixtures/infos/ios-hand-trace-walk_or_snap.json';
import iosHeightNull from './fixtures/infos/ios-height-range-null.json';
import iosR4Height from './fixtures/infos/ios-R4-height-resample30-range.json';
import iosR4Trace from './fixtures/infos/ios-R4-trace-walk_or_snap.json';

const text = (record: { response: unknown }) => JSON.stringify(record.response);
const FAILED = { ok: false, error: 'failed' };

const zone = {
  id: 'nancy',
  version: 3,
  bbox: { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49.5 },
} as unknown as Zone;
const SHAPE: [number, number][] = [
  [5.978104, 48.727358],
  [5.973731, 48.736598],
];
const ROUTE_OK = JSON.stringify({
  trip: {
    summary: { length: 1, time: 60 },
    legs: [{ shape: '_l`y{Aw~ksJoul@gwkA' }],
  },
});

function setup(overrides: Partial<NativeRouting> = {}) {
  const native: NativeRouting = {
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    route: jest.fn().mockResolvedValue(ROUTE_OK),
    height: jest.fn().mockResolvedValue(text(iosAbHeight)),
    traceAttributes: jest.fn().mockResolvedValue(text(iosAbTrace)),
    ...overrides,
  };
  const engine = createRoutingEngine(native, () => ({
    tarPath: '/a.tar',
    elevationDir: '/e',
  }));
  return { native, engine };
}

describe('ADR 0017 section 1: requests', () => {
  test('height request has exactly three keys, with the polyline of the shape', () => {
    const request = JSON.parse(buildHeightRequest(SHAPE));
    expect(Object.keys(request).sort()).toEqual([
      'encoded_polyline',
      'range',
      'resample_distance',
    ]);
    expect(request.range).toBe(true);
    expect(request.resample_distance).toBe(30);
    expect(request).not.toHaveProperty('height_precision');
    const back = decodePolyline6(request.encoded_polyline);
    expect(back).toHaveLength(2);
    expect(back[0][0]).toBeCloseTo(5.978104, 6);
    expect(back[1][1]).toBeCloseTo(48.736598, 6);
  });

  test('trace request: no shape field, no extra filter, route costing', () => {
    const request = JSON.parse(buildTraceRequest(SHAPE));
    expect(request).not.toHaveProperty('shape');
    expect(request).not.toHaveProperty('range');
    expect(request.shape_match).toBe('walk_or_snap');
    expect(request.filters.action).toBe('include');
    expect(request.filters.attributes).toEqual([
      'edge.use',
      'edge.density',
      'edge.length',
    ]);
    expect(request.costing).toBe('bicycle');
    expect(request.costing_options.bicycle.bicycle_type).toBe('mountain');
  });

  test('both requests encode the same polyline for the same shape', () => {
    expect(JSON.parse(buildHeightRequest(SHAPE)).encoded_polyline).toBe(
      JSON.parse(buildTraceRequest(SHAPE)).encoded_polyline,
    );
    expect(JSON.parse(buildTraceRequest(SHAPE)).encoded_polyline).toBe(
      encodePolyline6(SHAPE),
    );
  });

  test('the R4 trace polyline of the real request is rebuilt exactly', () => {
    const shape = decodePolyline6(iosR4Trace.request.encoded_polyline ?? '');
    expect(shape.length).toBeGreaterThan(100);
    expect(JSON.parse(buildHeightRequest(shape)).encoded_polyline).toBe(
      iosR4Height.request.encoded_polyline,
    );
  });
});

describe('real answers', () => {
  test('A-B: first and last altitude and distance step of 30 m', () => {
    const r = parseHeightResponse(text(iosAbHeight));
    if (!r.ok) throw new Error('expected success');
    expect(r.profile[0]).toEqual([0, 232]);
    expect(r.profile[1][0]).toBe(30);
    for (const [d, h] of r.profile) {
      expect(Number.isInteger(h)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
    }
    const distances = r.profile.map(([d]) => d);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  test('hand line: altitudes ok, trace refused (444) as failed', () => {
    expect(parseHeightResponse(text(iosHandHeight)).ok).toBe(true);
    expect(iosHandTrace.response).toMatchObject({ code: 444 });
    expect(parseTraceResponse(text(iosHandTrace))).toEqual(FAILED);
  });

  test('null altitudes (outside HGT tiles) are success, not failure', () => {
    const r = parseHeightResponse(text(iosHeightNull));
    expect(r.ok).toBe(true);
  });

  test('R4: trace edge lengths cover less than the engine distance, not more', () => {
    // 41.72 km traced for a 41.327 km profile: the parser must not rescale.
    const trace = parseTraceResponse(text(iosR4Trace));
    if (!trace.ok) throw new Error('expected success');
    const km = trace.edges.reduce((s, e) => s + e.lengthKm, 0);
    expect(km).toBeCloseTo(41.72, 6);
  });

  test.each([
    [312, 'height'],
    [114, 'trace'],
    [123, 'trace'],
    [444, 'trace'],
    [443, 'trace'],
    [-1, 'height'],
    [100, 'height'],
    [100, 'trace'],
    [999, 'trace'],
  ])('refusal code %i on %s is failed', (code, kind) => {
    const answer = JSON.stringify({ code, message: 'x' });
    const r =
      kind === 'height'
        ? parseHeightResponse(answer)
        : parseTraceResponse(answer);
    expect(r).toEqual(FAILED);
  });

  test.each([
    'null',
    '42',
    '"text"',
    '{"range_height":"no"}',
    '{"range_height":[[0,"a"]]}',
    '{"range_height":[[0,1,2]]}',
    '{"code":"312"}',
  ])('height garbage %p never throws and fails', (bad) => {
    expect(() => parseHeightResponse(bad)).not.toThrow();
    expect(parseHeightResponse(bad)).toEqual(FAILED);
  });

  test.each([
    'null',
    '42',
    '{"edges":"no"}',
    '{"edges":[null]}',
    '{"edges":[{"use":"road","length":"1"}]}',
    '{"code":444}',
  ])('trace garbage %p never throws and fails', (bad) => {
    expect(() => parseTraceResponse(bad)).not.toThrow();
    expect(parseTraceResponse(bad)).toEqual(FAILED);
  });

  test('an empty edge list is a success with no edge', () => {
    expect(parseTraceResponse('{"edges":[]}')).toEqual({
      ok: true,
      edges: [],
    });
  });
});

describe('engine: states', () => {
  test('closed engine (setZone(null)) gives engineUnavailable, no native call', async () => {
    const { native, engine } = setup();
    engine.setZone(zone);
    expect((await engine.height(SHAPE)).ok).toBe(true);
    engine.setZone(null);
    const unavailable = { ok: false, error: 'engineUnavailable' };
    expect(await engine.height(SHAPE)).toEqual(unavailable);
    expect(await engine.traceAttributes(SHAPE)).toEqual(unavailable);
    expect(native.height).toHaveBeenCalledTimes(1);
    expect(native.traceAttributes).not.toHaveBeenCalled();
  });

  test('native ERR_ENGINE_NOT_OPEN on trace gives engineUnavailable', async () => {
    const { engine } = setup({
      traceAttributes: jest
        .fn()
        .mockRejectedValue({ code: 'ERR_ENGINE_NOT_OPEN' }),
    });
    engine.setZone(zone);
    expect(await engine.traceAttributes(SHAPE)).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
  });

  test('an engine that failed to open answers not-ok, without a native call', async () => {
    const { native, engine } = setup({
      open: jest.fn().mockRejectedValue({ code: 'ERR_ZONE_UNREADABLE' }),
    });
    engine.setZone(zone);
    const h = await engine.height(SHAPE);
    const t = await engine.traceAttributes(SHAPE);
    expect(h.ok).toBe(false);
    expect(t.ok).toBe(false);
    expect(native.height).not.toHaveBeenCalled();
    expect(native.traceAttributes).not.toHaveBeenCalled();
  });

  test('a native call that throws synchronously gives failed', async () => {
    const { engine } = setup({
      height: jest.fn(() => {
        throw new Error('boom');
      }),
      traceAttributes: jest.fn(() => {
        throw new Error('boom');
      }),
    });
    engine.setZone(zone);
    expect(await engine.height(SHAPE)).toEqual(FAILED);
    expect(await engine.traceAttributes(SHAPE)).toEqual(FAILED);
  });

  test.each(['', 'not json', '{"code":312,"message":"m"}'])(
    'native answer %p gives failed without throwing',
    async (answer) => {
      const { engine } = setup({
        height: jest.fn().mockResolvedValue(answer),
        traceAttributes: jest.fn().mockResolvedValue(answer),
      });
      engine.setZone(zone);
      expect(await engine.height(SHAPE)).toEqual(FAILED);
      expect(await engine.traceAttributes(SHAPE)).toEqual(FAILED);
    },
  );

  test('an empty shape is failed, no native call', async () => {
    const { native, engine } = setup();
    engine.setZone(zone);
    expect(await engine.height([])).toEqual(FAILED);
    expect(await engine.traceAttributes([])).toEqual(FAILED);
    expect(native.height).not.toHaveBeenCalled();
    expect(native.traceAttributes).not.toHaveBeenCalled();
  });

  test('a failure does not block the next call', async () => {
    const { engine } = setup({
      height: jest
        .fn()
        .mockRejectedValueOnce({ code: 'ERR_ENGINE' })
        .mockResolvedValue(text(iosAbHeight)),
    });
    engine.setZone(zone);
    const [a, b] = await Promise.all([
      engine.height(SHAPE),
      engine.height(SHAPE),
    ]);
    expect(a).toEqual(FAILED);
    expect(b.ok).toBe(true);
  });

  test('infos are not limited by the zone rectangle (shape comes from the engine)', async () => {
    const { engine } = setup();
    engine.setZone(zone);
    const far: [number, number][] = [
      [0, 0],
      [0.01, 0.01],
    ];
    expect((await engine.height(far)).ok).toBe(true);
  });
});

describe('engine: abort and single queue', () => {
  test('a height call aborted while waiting behind a route is skipped', async () => {
    let release!: (t: string) => void;
    const { native, engine } = setup({
      route: jest.fn(() => new Promise<string>((r) => (release = r))),
    });
    engine.setZone(zone);
    const route = engine.route([
      { lon: 5.9, lat: 48.7 },
      { lon: 6, lat: 48.8 },
    ]);
    const controller = new AbortController();
    const height = engine.height(SHAPE, controller.signal);
    const trace = engine.traceAttributes(SHAPE);
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    release(ROUTE_OK);
    await route;
    expect(await height).toEqual(FAILED);
    expect((await trace).ok).toBe(true);
    expect(native.height).not.toHaveBeenCalled();
    expect(native.traceAttributes).toHaveBeenCalledTimes(1);
  });

  test('never two native calls at once, in call order, route height trace route', async () => {
    let running = 0;
    let maxRunning = 0;
    const order: string[] = [];
    const slow =
      (name: string, answer: string) => async (): Promise<string> => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        order.push(name);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return answer;
      };
    const { engine } = setup({
      route: jest.fn(slow('route', ROUTE_OK)),
      height: jest.fn(slow('height', text(iosAbHeight))),
      traceAttributes: jest.fn(slow('trace', text(iosAbTrace))),
    });
    engine.setZone(zone);
    const pts = [
      { lon: 5.9, lat: 48.7 },
      { lon: 6, lat: 48.8 },
    ];
    await Promise.all([
      engine.route(pts),
      engine.height(SHAPE),
      engine.traceAttributes(SHAPE),
      engine.route(pts),
    ]);
    expect(maxRunning).toBe(1);
    expect(order).toEqual(['route', 'height', 'trace', 'route']);
  });

  test('an already aborted signal never reaches the native module', async () => {
    const { native, engine } = setup();
    engine.setZone(zone);
    const c = new AbortController();
    c.abort();
    expect(await engine.height(SHAPE, c.signal)).toEqual(FAILED);
    expect(native.height).not.toHaveBeenCalled();
  });
});
