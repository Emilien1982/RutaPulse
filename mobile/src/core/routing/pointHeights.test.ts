import { buildPointHeightRequest } from './infoRequest';
import { parsePointHeights } from './infoResponse';
import { createRoutingEngine, type NativeRouting } from './routingEngine';
import { decodePolyline6 } from './routeResponse';
import type { Zone } from '../zones/catalogue';

const ZONE: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 1,
  bbox: { lonMin: 5, lonMax: 7, latMin: 48, latMax: 49 },
  osmDate: '2026-10-01',
  totalBytes: 1,
  files: [],
};
const SHAPE: [number, number][] = [
  [6.18, 48.69],
  [6.19, 48.7],
];

describe('buildPointHeightRequest', () => {
  it('has the polyline only: no resampling, no range', () => {
    const request = JSON.parse(buildPointHeightRequest(SHAPE));
    expect(Object.keys(request)).toEqual(['encoded_polyline']);
    expect(decodePolyline6(request.encoded_polyline)).toEqual(SHAPE);
  });
});

describe('parsePointHeights', () => {
  it('reads one altitude per point, null without data', () => {
    expect(parsePointHeights('{"height":[212,null,215]}')).toEqual({
      ok: true,
      heights: [212, null, 215],
    });
  });

  it('fails on an answer that is not heights', () => {
    expect(parsePointHeights('nope')).toEqual({ ok: false, error: 'failed' });
    expect(parsePointHeights('{"height":[]}').ok).toBe(false);
    expect(parsePointHeights('{"height":["a"]}').ok).toBe(false);
    expect(parsePointHeights('{"code":171}').ok).toBe(false);
  });
});

describe('engine.pointHeights', () => {
  function engineWith(height: jest.Mock) {
    const native: NativeRouting = {
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      route: jest.fn(),
      height,
    };
    return createRoutingEngine(native, () => ({
      tarPath: 't',
      elevationDir: 'e',
    }));
  }

  it('sends the request without resample_distance and reads the heights', async () => {
    const height = jest.fn().mockResolvedValue('{"height":[212,null]}');
    const engine = engineWith(height);
    await engine.setZone(ZONE);
    const result = await engine.pointHeights(SHAPE);
    expect(result).toEqual({ ok: true, heights: [212, null] });
    expect(height).toHaveBeenCalledWith(buildPointHeightRequest(SHAPE));
    expect(height.mock.calls[0][0]).not.toContain('resample_distance');
  });

  it('is unavailable when no zone is open', async () => {
    const engine = engineWith(jest.fn());
    expect(await engine.pointHeights(SHAPE)).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
  });
});
