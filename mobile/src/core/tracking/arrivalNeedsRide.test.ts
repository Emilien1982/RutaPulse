import type { Fix } from './placement';
import { MIN_RIDE_M } from './ride';
import { dense, lineOf, toLonLat, type XY } from './testing/fabricate';
import { buildLine } from './trackingLine';
import {
  createTracking,
  reduceTracking,
  type TrackingState,
} from './trackingState';

const T0 = 1_700_000_000_000;

const straight = {
  line: buildLine(
    lineOf(
      dense([
        [0, 0],
        [2000, 0],
      ]),
    ),
  ),
  free: [],
};

// Out and back: the end is 3 m from the start.
const closed = {
  line: buildLine(
    lineOf(
      dense([
        [0, 0],
        [1000, 0],
        [1000, 1],
        [3, 1],
      ]),
    ),
  ),
  free: [],
};

const fixAt = (xy: XY, seconds: number): Fix => {
  const [lon, lat] = toLonLat(xy);
  return { lon, lat, accuracy: 5, at: T0 + seconds * 1000 };
};

function run(source: typeof straight, xs: XY[]): TrackingState {
  return xs.reduce(
    (s, xy, i) =>
      reduceTracking(s, { type: 'fix', fix: fixAt(xy, (i + 1) * 5) }),
    createTracking(source, T0),
  );
}

const ride = (from: number, to: number, step = 20): XY[] => {
  const out: XY[] = [];
  for (let x = from; x <= to; x += step) out.push([x, 0]);
  return out;
};

describe('arrival needs a real ride', () => {
  it('does not arrive when the tracking starts on the end point', () => {
    const state = run(straight, [[2000, 0]]);
    expect(state.end).toBeNull();
    expect(state.ride.distanceM).toBeLessThan(MIN_RIDE_M);
  });

  it('arrives after the ride is long enough, back near the end', () => {
    const state = run(straight, [
      [2000, 0],
      ...ride(1900, 1500, 20),
      ...ride(1500, 1990, 20),
    ]);
    expect(state.ride.distanceM).toBeGreaterThanOrEqual(MIN_RIDE_M);
    expect(state.end).toBe('arrived');
  });

  it('arrives as before on a normal ride', () => {
    const state = run(straight, ride(0, 2000, 20));
    expect(state.end).toBe('arrived');
  });

  it('does not end a loop at its start, and still ends it at the end', () => {
    const atStart = run(closed, [[0, 0]]);
    expect(atStart.end).toBeNull();
    const state = run(closed, [
      ...ride(0, 1000, 20),
      [1000, 1],
      [500, 1],
      [100, 1],
      [3, 1],
    ]);
    expect(state.end).toBe('arrived');
  });
});
