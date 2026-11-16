// `traceRoute` and `matchedEdges` of the engine (ADR 0021, section 1.2): same
// queue and rules as the other calls; a missing function is a failure.
import { createRoutingEngine, type NativeRouting } from './routingEngine';
import type { Zone } from '../zones/catalogue';

const zone: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 1,
  bbox: { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49 },
  osmDate: '2026-10-22T00:00:00Z',
  totalBytes: 1,
  files: [],
};
const SHAPE: [number, number][] = [
  [6.1, 48.7],
  [6.11, 48.71],
];

function fake(extra: Partial<NativeRouting> = {}): NativeRouting {
  return {
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    route: jest.fn(),
    ...extra,
  };
}
const paths = () => ({ tarPath: '/t.tar', elevationDir: '/e' });

describe('traceRoute', () => {
  it('asks the native module and reads the answer', async () => {
    const answer = JSON.stringify({
      trip: {
        legs: [
          {
            shape: '_p~iF~ps|U_ulLnnqC',
            maneuvers: [{ type: 15, begin_shape_index: 1 }],
          },
        ],
      },
    });
    const traceRoute = jest.fn().mockResolvedValue(answer);
    const engine = createRoutingEngine(fake({ traceRoute }), paths);
    await engine.setZone(zone);
    const result = await engine.traceRoute(SHAPE);
    expect(traceRoute).toHaveBeenCalledTimes(1);
    const request = JSON.parse(traceRoute.mock.calls[0][0]);
    expect(request.shape_match).toBe('map_snap');
    expect(request.directions_options.language).toBe('fr-FR');
    expect(result.ok).toBe(true);
  });

  it('fails when the engine is closed', async () => {
    const engine = createRoutingEngine(fake({ traceRoute: jest.fn() }), paths);
    expect(await engine.traceRoute(SHAPE)).toEqual({
      ok: false,
      error: 'engineUnavailable',
    });
  });

  it('fails when the native function is missing', async () => {
    const engine = createRoutingEngine(fake(), paths);
    await engine.setZone(zone);
    expect((await engine.traceRoute(SHAPE)).ok).toBe(false);
  });

  it('skips an aborted call and never rejects', async () => {
    const traceRoute = jest.fn().mockRejectedValue(new Error('boom'));
    const engine = createRoutingEngine(fake({ traceRoute }), paths);
    await engine.setZone(zone);
    const abort = new AbortController();
    abort.abort();
    expect((await engine.traceRoute(SHAPE, abort.signal)).ok).toBe(false);
    expect(traceRoute).not.toHaveBeenCalled();
    expect((await engine.traceRoute(SHAPE)).ok).toBe(false);
  });
});

describe('matchedEdges', () => {
  it('uses trace_attributes with map_snap', async () => {
    const traceAttributes = jest.fn().mockResolvedValue('{"code":171}');
    const engine = createRoutingEngine(fake({ traceAttributes }), paths);
    await engine.setZone(zone);
    const result = await engine.matchedEdges(SHAPE);
    const request = JSON.parse(traceAttributes.mock.calls[0][0]);
    expect(request.shape_match).toBe('map_snap');
    expect(request.filters.attributes).toContain('edge.begin_shape_index');
    expect(result.ok).toBe(false);
  });
});
