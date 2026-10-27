// Tester tests, written from the spec (C6) and ADR 0015 section 5.
import {
  decodePolyline6,
  kindFromNativeError,
  kindFromValhallaCode,
  parseRouteResponse,
} from './routeResponse';

describe('decodePolyline6', () => {
  // External reference: the Google encoded polyline algorithm
  // (https://developers.google.com/maps/documentation/utilities/polylinealgorithm)
  // gives "_p~iF~ps|U_ulLnnqC_mqNvxq`@" at 5 decimals for
  // (38.5,-120.2), (40.7,-120.95), (43.252,-126.453). Valhalla uses the same
  // algorithm with a factor 1e6 (https://valhalla.github.io/valhalla/decoding/).
  // The 6-decimal string below comes from an independent encoder (Python,
  // written by the tester) that first reproduced the Google 5-decimal string
  // exactly, then was run with factor 1e6.
  const GOOGLE_5 = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  const SIX = '_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI';

  it('decodes the 6-decimal encoding of the Google example', () => {
    const pts = decodePolyline6(SIX);
    expect(pts).toHaveLength(3);
    const expected = [
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ];
    pts.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(expected[i][0], 6);
      expect(p[1]).toBeCloseTo(expected[i][1], 6);
    });
  });

  it('decodes a Nancy pair encoded the same way', () => {
    const pts = decodePolyline6('_l`y{Aw~ksJoul@gwkA');
    expect(pts[0][0]).toBeCloseTo(6.1015, 6);
    expect(pts[0][1]).toBeCloseTo(48.6612, 6);
    expect(pts[1][0]).toBeCloseTo(6.1408, 6);
    expect(pts[1][1]).toBeCloseTo(48.6846, 6);
  });

  it('does not read the 5-decimal string as 6 decimals', () => {
    const pts = decodePolyline6(GOOGLE_5);
    expect(pts[0][1]).not.toBeCloseTo(38.5, 1);
  });

  it('returns nothing for an empty string', () => {
    expect(decodePolyline6('')).toEqual([]);
  });
});

describe('kindFromValhallaCode (section 5)', () => {
  it.each([
    [171, 'outOfZone'],
    [442, 'noRoute'],
    [441, 'noRoute'],
    [170, 'noRoute'],
    [999, 'failed'],
    [-1, 'failed'],
    [443, 'failed'],
  ])('code %i -> %s', (code, kind) => {
    expect(kindFromValhallaCode(code)).toBe(kind);
  });
});

describe('kindFromNativeError (section 5)', () => {
  it.each([
    ['ERR_ENGINE_NOT_OPEN', 'engineUnavailable'],
    ['ERR_ZONE_UNREADABLE', 'zoneUnreadable'],
    ['ERR_ENGINE', 'failed'],
    ['ERR_SOMETHING_NEW', 'failed'],
  ])('%s -> %s', (code, kind) => {
    expect(kindFromNativeError({ code, message: 'x' })).toBe(kind);
  });

  it('the message text does not matter', () => {
    expect(
      kindFromNativeError({ code: 'ERR_ZONE_UNREADABLE', message: 'aaa' }),
    ).toBe(
      kindFromNativeError({ code: 'ERR_ZONE_UNREADABLE', message: 'zzz 171' }),
    );
    expect(
      kindFromNativeError({ code: 'ERR_ENGINE_NOT_OPEN', message: 'zone' }),
    ).toBe('engineUnavailable');
  });

  it('an error without code is a failure, never an exception', () => {
    expect(kindFromNativeError(new Error('boom'))).toBe('failed');
    expect(kindFromNativeError(undefined)).toBe('failed');
    expect(kindFromNativeError(null)).toBe('failed');
    expect(kindFromNativeError('text')).toBe('failed');
  });
});

describe('parseRouteResponse (C6)', () => {
  const err = (code: unknown, message = 'm') =>
    JSON.stringify({ code, message });

  it.each([
    [171, 'outOfZone'],
    [442, 'noRoute'],
    [441, 'noRoute'],
    [170, 'noRoute'],
    [12345, 'failed'],
  ])('refusal %i -> %s', (code, kind) => {
    expect(parseRouteResponse(err(code))).toEqual({ ok: false, error: kind });
  });

  it('same code, different messages -> same kind', () => {
    expect(
      parseRouteResponse(err(171, 'No suitable edges near location')),
    ).toEqual(
      parseRouteResponse(err(171, 'ValhallaError(code=442, autre chose)')),
    );
  });

  it('text that is not JSON is a failure, no throw', () => {
    expect(parseRouteResponse('<html>oops</html>')).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(parseRouteResponse('')).toEqual({ ok: false, error: 'failed' });
  });

  it('JSON without trip nor code is a failure', () => {
    expect(parseRouteResponse('{}')).toEqual({ ok: false, error: 'failed' });
    expect(parseRouteResponse('null')).toEqual({ ok: false, error: 'failed' });
    expect(parseRouteResponse('[1,2]')).toEqual({ ok: false, error: 'failed' });
    expect(parseRouteResponse('42')).toEqual({ ok: false, error: 'failed' });
  });

  it('reads a success: shape, distance in km, duration in s', () => {
    const shape = '_l`y{Aw~ksJoul@gwkA';
    const res = parseRouteResponse(
      JSON.stringify({
        trip: { summary: { length: 5.918, time: 1253.829 }, legs: [{ shape }] },
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.distanceKm).toBe(5.918);
      expect(res.durationS).toBe(1253.829);
      expect(res.shape).toHaveLength(2);
      expect(res.shape[0][1]).toBeCloseTo(48.6612, 6);
    }
  });

  it('joins two legs without duplicating the shared point', () => {
    const leg1 = '_l`y{Aw~ksJoul@gwkA'; // (48.6612,6.1015) -> (48.6846,6.1408)
    const leg2 = 'obnz{A_wxuJopI_~P'; // (48.6846,6.1408) -> (48.69,6.15)
    const res = parseRouteResponse(
      JSON.stringify({
        trip: {
          summary: { length: 1, time: 1 },
          legs: [{ shape: leg1 }, { shape: leg2 }],
        },
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.shape).toHaveLength(3);
      expect(res.shape[2][0]).toBeCloseTo(6.15, 6);
      expect(res.shape[2][1]).toBeCloseTo(48.69, 6);
    }
  });

  it('a truncated success (no summary) is a failure', () => {
    expect(parseRouteResponse('{"trip":{"legs":[]}}')).toEqual({
      ok: false,
      error: 'failed',
    });
  });
});
