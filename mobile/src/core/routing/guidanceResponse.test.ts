import { parseMatchedEdges, parseTraceRouteResponse } from './guidanceResponse';
import { encodePolyline6 } from './routeResponse';

import attributes1 from '../tracking/fixtures/trace-attributes-1.json';
import route1 from '../tracking/fixtures/trace-route-1.json';
import route2 from '../tracking/fixtures/trace-route-2.json';
import route3 from '../tracking/fixtures/trace-route-3.json';
import route3d from '../tracking/fixtures/trace-route-3d.json';
import ios171 from './fixtures/ios-171.json';

describe('parseTraceRouteResponse', () => {
  // Number of directions of the engine in the files of the trial
  // (essais/08-suivi-velo/resultats/*-directions-trace_route-map_snap.md).
  it.each([
    ['1', route1, 68],
    ['2', route2, 40],
    ['3', route3, 53],
    ['3d', route3d, 52],
  ])('reads the recorded answer %s', (_name, answer, count) => {
    const result = parseTraceRouteResponse(JSON.stringify(answer));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.maneuvers).toHaveLength(count);
    expect(result.maneuvers[0]?.type).toBe(1);
    expect(result.maneuvers[0]?.beginShapeIndex).toBe(0);
    expect(result.shape.length).toBeGreaterThan(1000);
  });

  it('reads the exit of a roundabout', () => {
    const result = parseTraceRouteResponse(JSON.stringify(route1));
    if (!result.ok) throw new Error('not read');
    const roundabout = result.maneuvers.find((m) => m.type === 26);
    expect(roundabout?.exitCount).toBe(2);
  });

  it('puts two legs end to end and shifts the indices', () => {
    const a = encodePolyline6([
      [6, 48],
      [6.001, 48],
    ]);
    const b = encodePolyline6([
      [6.001, 48],
      [6.002, 48],
      [6.003, 48],
    ]);
    const text = JSON.stringify({
      trip: {
        legs: [
          { shape: a, maneuvers: [{ type: 1, begin_shape_index: 0 }] },
          { shape: b, maneuvers: [{ type: 10, begin_shape_index: 1 }] },
        ],
      },
    });
    const result = parseTraceRouteResponse(text);
    if (!result.ok) throw new Error('not read');
    expect(result.shape).toHaveLength(4);
    expect(result.maneuvers.map((m) => m.beginShapeIndex)).toEqual([0, 2]);
  });

  it('gives a failure for a refusal, a bad answer and a bad text', () => {
    expect(parseTraceRouteResponse(JSON.stringify(ios171))).toEqual({
      ok: false,
      error: 'farFromPath',
    });
    expect(parseTraceRouteResponse('{"trip":{"legs":[{"shape":3}]}}')).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(parseTraceRouteResponse('not json')).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(parseTraceRouteResponse('[]')).toEqual({
      ok: false,
      error: 'failed',
    });
  });
});

describe('parseMatchedEdges', () => {
  it('reads the recorded answer', () => {
    const result = parseMatchedEdges(JSON.stringify(attributes1));
    if (!result.ok) throw new Error('not read');
    expect(result.edges.length).toBeGreaterThan(100);
    expect(result.edges[0]?.beginShapeIndex).toBe(0);
    expect(result.shape.length).toBeGreaterThan(1000);
    expect(result.edges.every((e) => e.use !== '')).toBe(true);
  });

  it('gives a failure for a refusal and a bad answer', () => {
    expect(parseMatchedEdges(JSON.stringify(ios171))).toEqual({
      ok: false,
      error: 'farFromPath',
    });
    expect(parseMatchedEdges('{"edges":[{"use":"path"}],"shape":"_"}')).toEqual(
      {
        ok: false,
        error: 'failed',
      },
    );
    expect(parseMatchedEdges('')).toEqual({ ok: false, error: 'failed' });
  });
});
