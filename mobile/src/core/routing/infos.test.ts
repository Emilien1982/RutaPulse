import { buildHeightRequest, buildTraceRequest } from './infoRequest';
import { parseHeightResponse, parseTraceResponse } from './infoResponse';
import { createRoutingEngine, type NativeRouting } from './routingEngine';
import { decodePolyline6, encodePolyline6 } from './routeResponse';
import type { Zone } from '../zones/catalogue';

import androidAbHeight from './fixtures/infos/android-AB-height-resample30-range.json';
import androidAbTrace from './fixtures/infos/android-AB-trace-walk_or_snap.json';
import androidHandTrace from './fixtures/infos/android-hand-trace-walk_or_snap.json';
import androidNoShape from './fixtures/infos/android-err-height-no-shape.json';
import androidNotJson from './fixtures/infos/android-err-height-not-json.json';
import androidEmpty from './fixtures/infos/android-err-trace-empty-shape.json';
import androidOnePoint from './fixtures/infos/android-err-trace-one-point.json';
import androidOutOfZone from './fixtures/infos/android-err-trace-out-of-zone.json';
import iosAbHeight from './fixtures/infos/ios-AB-height-resample30-range.json';
import iosAbTrace from './fixtures/infos/ios-AB-trace-walk_or_snap.json';
import iosHandHeight from './fixtures/infos/ios-hand-height-resample30-range.json';
import iosHandTrace from './fixtures/infos/ios-hand-trace-walk_or_snap.json';
import iosNoShape from './fixtures/infos/ios-err-height-no-shape.json';
import iosNotJson from './fixtures/infos/ios-err-height-not-json.json';
import iosEmpty from './fixtures/infos/ios-err-trace-empty-shape.json';
import iosOnePoint from './fixtures/infos/ios-err-trace-one-point.json';
import iosOutOfZone from './fixtures/infos/ios-err-trace-out-of-zone.json';
import iosFinalTrace from './fixtures/infos/ios-AB-trace-final.json';
import iosHeightNull from './fixtures/infos/ios-height-range-null.json';
import iosSuccess from './fixtures/ios-success.json';
import iosR4Height from './fixtures/infos/ios-R4-height-resample30-range.json';
import iosR4Trace from './fixtures/infos/ios-R4-trace-walk_or_snap.json';

// Real answers of the native module (see fixtures/infos/SOURCE.md).
const text = (record: { response: unknown }) => JSON.stringify(record.response);

const platforms = [
  {
    name: 'ios',
    height: iosAbHeight,
    trace: iosAbTrace,
    handTrace: iosHandTrace,
    noShape: iosNoShape,
    notJson: iosNotJson,
    empty: iosEmpty,
    onePoint: iosOnePoint,
    outOfZone: iosOutOfZone,
  },
  {
    name: 'android',
    height: androidAbHeight,
    trace: androidAbTrace,
    handTrace: androidHandTrace,
    noShape: androidNoShape,
    notJson: androidNotJson,
    empty: androidEmpty,
    onePoint: androidOnePoint,
    outOfZone: androidOutOfZone,
  },
];

describe.each(platforms)('infos, relevé $name', (p) => {
  test('height A-B: 51 points, from 0 m, altitudes in whole meters', () => {
    const result = parseHeightResponse(text(p.height));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toHaveLength(51);
    expect(result.profile[0]).toEqual([0, 232]);
    expect(result.profile[50]).toEqual([1464, 244]);
  });

  test('trace A-B: edges with use, density and length in km', () => {
    const result = parseTraceResponse(text(p.trace));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edges.length).toBe(p.trace.response.edges?.length);
    expect(result.edges[0]).toEqual({
      use: 'road',
      density: 2,
      lengthKm: 0.022,
    });
    const total = result.edges.reduce((sum, e) => sum + e.lengthKm, 0);
    // Sum measured on the raw answer: 33 edges, 1.492 km.
    expect(result.edges).toHaveLength(33);
    expect(total).toBeCloseTo(1.492, 6);
  });

  test.each([
    ['hand line (444)', p.handTrace, 'trace'],
    ['trace out of tiles (444)', p.outOfZone, 'trace'],
    ['trace empty shape (114)', p.empty, 'trace'],
    ['trace one point (123)', p.onePoint, 'trace'],
    ['height without shape (312)', p.noShape, 'height'],
    ['height invalid JSON (-1)', p.notJson, 'height'],
  ])('refusal %s is a failed result', (_name, record, kind) => {
    const result =
      kind === 'trace'
        ? parseTraceResponse(text(record))
        : parseHeightResponse(text(record));
    expect(result).toEqual({ ok: false, error: 'failed' });
  });
});

describe('infos, autres relevés', () => {
  test('height of a hand line works (it has no route)', () => {
    const result = parseHeightResponse(text(iosHandHeight));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile).toHaveLength(12);
  });

  test('R4 (42 km): 1 406 altitudes and 457 edges', () => {
    const height = parseHeightResponse(text(iosR4Height));
    const trace = parseTraceResponse(text(iosR4Trace));
    expect(height.ok && trace.ok).toBe(true);
    if (!height.ok || !trace.ok) return;
    expect(height.profile).toHaveLength(1406);
    expect(height.profile[1405]).toEqual([41327, 256]);
    expect(trace.edges).toHaveLength(457);
    // Sum measured on the raw answer: 41.72 km.
    const total = trace.edges.reduce((sum, e) => sum + e.lengthKm, 0);
    expect(total).toBeCloseTo(41.72, 6);
  });
});

describe("infos, relevé final de l'app (build release T2)", () => {
  test('range_height with null altitudes is kept', () => {
    const result = parseHeightResponse(text(iosHeightNull));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toHaveLength(16);
    expect(result.profile.every(([, h]) => h === null)).toBe(true);
    expect(result.profile[15]).toEqual([445, null]);
  });

  test('trace with the 3-field filter: same edges as A-B', () => {
    const result = parseTraceResponse(text(iosFinalTrace));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edges).toHaveLength(33);
    expect(result.edges[0]).toEqual({
      use: 'road',
      density: 2,
      lengthKm: 0.022,
    });
    const total = result.edges.reduce((sum, e) => sum + e.lengthKm, 0);
    expect(total).toBeCloseTo(1.492, 6);
  });
});

describe('parse, cas non relevés', () => {
  // Invented: a mix of null and numbers, which the app has not produced.
  test('null altitudes mixed with numbers are kept', () => {
    const result = parseHeightResponse(
      '{"range_height":[[0,244],[30,null],[60,null]]}',
    );
    expect(result).toEqual({
      ok: true,
      profile: [
        [0, 244],
        [30, null],
        [60, null],
      ],
    });
  });

  test('a missing density is 0', () => {
    const result = parseTraceResponse(
      '{"edges":[{"use":"path","length":0.1}]}',
    );
    expect(result).toEqual({
      ok: true,
      edges: [{ use: 'path', density: 0, lengthKm: 0.1 }],
    });
  });

  test.each([
    '',
    'oops',
    '[]',
    '{}',
    '{"range_height":[]}',
    '{"range_height":[[1]]}',
  ])('unreadable height answer %p fails without throwing', (bad) => {
    expect(parseHeightResponse(bad)).toEqual({ ok: false, error: 'failed' });
  });

  test.each(['', 'oops', '[]', '{}', '{"edges":[{"use":"road"}]}'])(
    'unreadable trace answer %p fails without throwing',
    (bad) => {
      expect(parseTraceResponse(bad)).toEqual({ ok: false, error: 'failed' });
    },
  );
});

describe('requests', () => {
  const shape = decodePolyline6(iosAbHeight.request.encoded_polyline ?? '');

  test('encodePolyline6 gives back the polyline of the real requests', () => {
    expect(shape.length).toBeGreaterThan(10);
    expect(encodePolyline6(shape)).toBe(iosAbHeight.request.encoded_polyline);
    const r4 = decodePolyline6(iosR4Trace.request.encoded_polyline ?? '');
    expect(encodePolyline6(r4)).toBe(iosR4Trace.request.encoded_polyline);
  });

  test('encodePolyline6 of nothing is empty; negative values round trip', () => {
    expect(encodePolyline6([])).toBe('');
    const points: [number, number][] = [
      [-1.5, -45.123456],
      [2.000001, 0],
    ];
    expect(decodePolyline6(encodePolyline6(points))).toEqual(points);
  });

  test('height request is exactly the one of the trial', () => {
    expect(JSON.parse(buildHeightRequest(shape))).toEqual(iosAbHeight.request);
    expect(buildHeightRequest(shape)).toContain('"resample_distance":30');
  });

  test('trace request keeps the costing and the filters of ADR 0017', () => {
    const request = JSON.parse(buildTraceRequest(shape));
    expect(request).toEqual({
      encoded_polyline: iosAbHeight.request.encoded_polyline,
      costing: 'bicycle',
      costing_options: { bicycle: { bicycle_type: 'mountain', use_roads: 0 } },
      shape_match: 'walk_or_snap',
      filters: {
        attributes: ['edge.use', 'edge.density', 'edge.length'],
        action: 'include',
      },
    });
  });
});

describe('engine height and traceAttributes', () => {
  const zone = {
    id: 'nancy',
    version: 3,
    bbox: { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49.5 },
  } as unknown as Zone;
  const shape: [number, number][] = [
    [5.978104, 48.727358],
    [5.973731, 48.736598],
  ];

  function setup(overrides: Partial<NativeRouting> = {}) {
    const native: NativeRouting = {
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      route: jest.fn(),
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

  test('before opening: engineUnavailable, no native call', async () => {
    const { native, engine } = setup();
    expect(await engine.height(shape)).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
    expect(native.height).not.toHaveBeenCalled();
  });

  test('both calls go to the native module with the exact requests', async () => {
    const { native, engine } = setup();
    engine.setZone(zone);
    const height = await engine.height(shape);
    const trace = await engine.traceAttributes(shape);
    expect(height.ok && trace.ok).toBe(true);
    expect(native.height).toHaveBeenCalledWith(buildHeightRequest(shape));
    expect(native.traceAttributes).toHaveBeenCalledWith(
      buildTraceRequest(shape),
    );
  });

  test('one native call at a time: route, then height, then trace', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { engine } = setup({
      route: jest.fn(async () => {
        order.push('route start');
        await gate;
        order.push('route end');
        return JSON.stringify(iosSuccess);
      }),
      height: jest.fn(async () => {
        order.push('height');
        return text(iosAbHeight);
      }),
      traceAttributes: jest.fn(async () => {
        order.push('trace');
        return text(iosAbTrace);
      }),
    });
    engine.setZone(zone);
    const first = engine.route(shape.map(([lon, lat]) => ({ lon, lat })));
    const second = engine.height(shape);
    const third = engine.traceAttributes(shape);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(['route start']);
    release();
    await Promise.all([first, second, third]);
    expect(order).toEqual(['route start', 'route end', 'height', 'trace']);
  });

  test('ERR_ENGINE and other rejections give failed', async () => {
    const { engine } = setup({
      height: jest.fn().mockRejectedValue({ code: 'ERR_ENGINE' }),
      traceAttributes: jest.fn().mockRejectedValue({ code: 'ERR_ENGINE' }),
    });
    engine.setZone(zone);
    expect(await engine.height(shape)).toEqual({ ok: false, error: 'failed' });
    expect(await engine.traceAttributes(shape)).toEqual({
      ok: false,
      error: 'failed',
    });
  });

  test('an aborted call is skipped', async () => {
    const { native, engine } = setup();
    engine.setZone(zone);
    const controller = new AbortController();
    controller.abort();
    expect(await engine.traceAttributes(shape, controller.signal)).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(native.traceAttributes).not.toHaveBeenCalled();
  });

  test('a Valhalla refusal and a rejected promise both give failed or unavailable', async () => {
    const { engine } = setup({
      traceAttributes: jest.fn().mockResolvedValue(text(iosOutOfZone)),
      height: jest.fn().mockRejectedValue({ code: 'ERR_ENGINE_NOT_OPEN' }),
    });
    engine.setZone(zone);
    expect(await engine.traceAttributes(shape)).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(await engine.height(shape)).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
  });

  test('a shape of one point is failed, with no native call', async () => {
    const { native, engine } = setup();
    engine.setZone(zone);
    expect(await engine.height([shape[0]])).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(native.height).not.toHaveBeenCalled();
  });

  test('a native module without the new functions gives failed', async () => {
    const { engine } = setup({ height: undefined });
    engine.setZone(zone);
    expect(await engine.height(shape)).toEqual({ ok: false, error: 'failed' });
  });
});
