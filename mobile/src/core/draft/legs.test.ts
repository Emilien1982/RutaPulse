// Narrow no-break space (U+202F) before the unit: gap M1 of design/comparaisons/p03-t6.md.
import {
  reduceDraft,
  createDraftState,
  type Draft,
  type LegMode,
} from './draft';
import { formatDuration } from '../routing/formatRoute';
import { distanceMeters } from '../routing/routeLink';
import { HAND_SPEED_KMH, handLeg, listLegs, summarize } from './legs';

/** Points on one meridian, 0.1 degree apart (11.1195 km). */
function line(modes: LegMode[]): Draft {
  return {
    points: [...modes, 'x'].map((_, i) => ({
      id: i + 1,
      lon: 6,
      lat: 48 + i * 0.1,
    })),
    modes,
  };
}
const KM_PER_STEP =
  distanceMeters({ lon: 6, lat: 48 }, { lon: 6, lat: 48.1 }) / 1000;

describe('listLegs', () => {
  it('is empty under 2 points', () => {
    expect(listLegs(line([]))).toEqual([]);
    expect(listLegs({ points: [], modes: [] })).toEqual([]);
  });

  it('pairs consecutive points with the mode of the leg', () => {
    const d = line(['path', 'hand']);
    const legs = listLegs(d);
    expect(legs.map((l) => [l.index, l.from.id, l.to.id, l.mode])).toEqual([
      [0, 1, 2, 'path'],
      [1, 2, 3, 'hand'],
    ]);
  });

  it('follows a draft built by the reducer', () => {
    let s = createDraftState();
    s = reduceDraft(s, { type: 'add', lon: 1, lat: 1 });
    s = reduceDraft(s, { type: 'add', lon: 2, lat: 2 });
    s = reduceDraft(s, { type: 'loop' });
    expect(listLegs(s.draft)).toHaveLength(2);
  });
});

describe('handLeg', () => {
  it('is the great-circle distance at the given speed', () => {
    const [a, b] = line(['hand']).points;
    const leg = handLeg(a!, b!, 20);
    expect(leg.distanceKm).toBeCloseTo(KM_PER_STEP, 6);
    expect(leg.durationS).toBeCloseTo((KM_PER_STEP / 20) * 3600, 3);
  });

  it('uses 10 km/h by default', () => {
    expect(HAND_SPEED_KMH).toBe(10);
    const [a, b] = line(['hand']).points;
    expect(handLeg(a!, b!).durationS).toBeCloseTo((KM_PER_STEP / 10) * 3600, 3);
  });
});

describe('handLeg reference value', () => {
  it('0.1 degree of latitude is 11.1195 km, about 4003 s at 10 km/h', () => {
    const leg = handLeg(
      { id: 1, lon: 6, lat: 48 },
      { id: 2, lon: 6, lat: 48.1 },
    );
    expect(leg.distanceKm).toBeCloseTo(11.1195, 3);
    expect(leg.durationS).toBeCloseTo(4003, 0);
  });
});

describe('summarize', () => {
  it('averages as total distance over total duration (13.33 km/h)', () => {
    // 10 km in 1 h and 10 km in 0.5 h: 20 km / 1.5 h, not (10 + 20) / 2.
    const s = summarize(line(['path', 'path', 'hand']), [
      { distanceKm: 10, durationS: 3600 },
      { distanceKm: 10, durationS: 1800 },
      undefined,
    ]);
    const handS = s.durationS - 5400;
    expect((KM_PER_STEP / handS) * 3600).toBeCloseTo(13.333, 2);
  });

  it('falls back to 10 km/h when engine legs are 0 km for some seconds', () => {
    const s = summarize(line(['path', 'hand']), [
      { distanceKm: 0, durationS: 5 },
      undefined,
    ]);
    expect(Number.isFinite(s.durationS)).toBe(true);
    expect(s.durationS).toBeCloseTo(5 + (KM_PER_STEP / 10) * 3600, 3);
  });

  it('is zero and complete for an empty or one-point draft', () => {
    expect(summarize(line([]), [])).toEqual({
      distanceKm: 0,
      durationS: 0,
      complete: true,
    });
  });

  it('adds the engine legs', () => {
    const s = summarize(line(['path', 'path']), [
      { distanceKm: 3, durationS: 600 },
      { distanceKm: 2, durationS: 300 },
    ]);
    expect(s).toEqual({ distanceKm: 5, durationS: 900, complete: true });
  });

  it('does not count a path leg without result, and says so', () => {
    const s = summarize(line(['path', 'path']), [
      { distanceKm: 3, durationS: 600 },
      undefined,
    ]);
    expect(s).toEqual({ distanceKm: 3, durationS: 600, complete: false });
  });

  it('gives a hand leg the average speed of the engine legs', () => {
    // 10 km in 1 h + 30 km in 1 h = 20 km/h.
    const s = summarize(line(['path', 'path', 'hand']), [
      { distanceKm: 10, durationS: 3600 },
      { distanceKm: 30, durationS: 3600 },
      undefined,
    ]);
    expect(s.complete).toBe(true);
    expect(s.distanceKm).toBeCloseTo(40 + KM_PER_STEP, 6);
    expect(s.durationS).toBeCloseTo(7200 + (KM_PER_STEP / 20) * 3600, 3);
  });

  it('ignores the result stored for a hand leg', () => {
    const s = summarize(line(['hand']), [{ distanceKm: 99, durationS: 99 }]);
    expect(s.distanceKm).toBeCloseTo(KM_PER_STEP, 6);
  });

  it('uses 10 km/h when there is no engine leg', () => {
    const s = summarize(line(['hand', 'hand']), []);
    expect(s.distanceKm).toBeCloseTo(2 * KM_PER_STEP, 6);
    expect(s.durationS).toBeCloseTo(((2 * KM_PER_STEP) / 10) * 3600, 3);
  });

  it('uses 10 km/h when the only path legs have no result', () => {
    const s = summarize(line(['path', 'hand']), [undefined, undefined]);
    expect(s.complete).toBe(false);
    expect(s.durationS).toBeCloseTo((KM_PER_STEP / 10) * 3600, 3);
  });

  it('does not divide by zero when engine legs last 0 s', () => {
    const s = summarize(line(['path', 'hand']), [
      { distanceKm: 0, durationS: 0 },
      undefined,
    ]);
    expect(Number.isFinite(s.durationS)).toBe(true);
    expect(s.durationS).toBeCloseTo((KM_PER_STEP / 10) * 3600, 3);
  });

  it('ends up as "1 min" when the sum is under a minute', () => {
    const s = summarize(line(['path']), [{ distanceKm: 0.05, durationS: 20 }]);
    expect(s.durationS).toBe(20);
    expect(formatDuration(s.durationS)).toBe('1\u202Fmin');
    expect(formatDuration(summarize(line([]), []).durationS)).toBe(
      '1\u202Fmin',
    );
  });
});
