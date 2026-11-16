import type { Fix } from './placement';
import { dense, lineOf, toLonLat, type XY } from './testing/fabricate';
import { buildLine } from './trackingLine';
import {
  createTracking,
  reduceTracking,
  remainingOf,
  type TrackingState,
} from './trackingState';

const T0 = 1_700_000_000_000;
const source = {
  line: buildLine(
    lineOf(
      dense([
        [0, 0],
        [5000, 0],
      ]),
    ),
  ),
  free: [],
};

const fixAt = (xy: XY, seconds: number): Fix => {
  const [lon, lat] = toLonLat(xy);
  return { lon, lat, accuracy: 5, at: T0 + seconds * 1000 };
};

function run(fixes: Fix[]): TrackingState {
  return fixes.reduce(
    (s, fix) => reduceTracking(s, { type: 'fix', fix }),
    createTracking(source, T0),
  );
}

describe('start coherence', () => {
  it('shows a lone first position, then drops it when the next is not plausible', () => {
    const lone = run([fixAt([2000, 0], 1)]);
    expect(lone.hasFix).toBe(true);
    expect(lone.placement.progressM).toBeCloseTo(2000, -1);
    const s = run([
      fixAt([2000, 0], 1),
      fixAt([10, 0], 2),
      fixAt([20, 0], 3),
      fixAt([30, 0], 4),
    ]);
    expect(s.placement.progressM).toBeCloseTo(30, -1);
    expect(s.ride.distanceM).toBeGreaterThan(15);
    expect(s.ride.distanceM).toBeLessThan(30);
    expect(remainingOf(s)).toBeCloseTo(4970, -1);
    expect(s.startedAt).toBe(T0);
  });

  it('changes nothing when the first two are coherent', () => {
    const s = run([fixAt([10, 0], 1), fixAt([20, 0], 2)]);
    expect(s.hasFix).toBe(true);
    expect(s.placement.progressM).toBeCloseTo(20, -1);
    expect(s.ride.distanceM).toBeCloseTo(10, -1);
  });

  it('accepts a real high speed under 25 m/s', () => {
    const s = run([fixAt([10, 0], 1), fixAt([34, 0], 2)]);
    expect(s.placement.progressM).toBeCloseTo(34, -1);
    expect(s.ride.distanceM).toBeCloseTo(24, -1);
  });

  it('drops the first at 25 m/s or more', () => {
    const s = run([fixAt([10, 0], 1), fixAt([40, 0], 2)]);
    expect(s.placement.progressM).toBeCloseTo(40, -1);
    expect(s.ride.distanceM).toBe(0);
  });

  it('does not play once two coherent positions are kept', () => {
    const s = run([fixAt([10, 0], 1), fixAt([20, 0], 2), fixAt([2000, 0], 3)]);
    expect(s.startCheck).toBe('done');
    expect(s.lastFixAt).toBe(T0 + 3000);
    expect(s.ride.distanceM).toBeGreaterThan(10);
  });
});
