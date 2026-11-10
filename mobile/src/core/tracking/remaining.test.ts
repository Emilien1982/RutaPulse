import { ascentDescent } from '@/core/route-info/elevation';
import type { ProfilePoint } from '@/core/routing/infoResponse';

import { initialPlacement, type Placement } from './placement';
import { climbProfile, remainingClimbM, remainingM } from './remaining';
import { lineOf } from './testing/fabricate';
import { buildLine } from './trackingLine';

const line = buildLine(
  lineOf([
    [0, 0],
    [2400, 0],
  ]),
);
const on = (progressM: number): Placement => ({
  ...initialPlacement(),
  phase: 'onTrack',
  progressM,
});

// Altitudes every 30 m. Counted by hand with the threshold of 5 m: 100 -> 110
// (+10), 104 -> 120 (+16), 120 -> 130 (+10), 126 -> 140 (+10): 46 m.
const heights = [100, 102, 110, 108, 104, 120, 130, 126, 140];
const profile: ProfilePoint[] = heights.map((h, i) => [i * 300, h]);

describe('remainingM', () => {
  it('is all the line before the track, then what is left after the progress', () => {
    expect(remainingM(line, initialPlacement())).toBeCloseTo(2400, 0);
    expect(remainingM(line, on(0))).toBeCloseTo(2400, 0);
    expect(remainingM(line, on(900))).toBeCloseTo(1500, 0);
    expect(remainingM(line, on(2400))).toBeCloseTo(0, 0);
  });

  it('counts from the target when off the track', () => {
    const off: Placement = {
      ...on(900),
      phase: 'offTrack',
      targetM: 1000,
      gapM: 80,
    };
    expect(remainingM(line, off)).toBeCloseTo(1400, 0);
  });
});

describe('climbProfile', () => {
  it('counts 46 m, as the ascent of the Infos screen does', () => {
    const climb = climbProfile(profile);
    expect(climb?.totalM).toBe(46);
    expect(climb?.climbAt).toEqual([0, 0, 10, 10, 10, 26, 36, 36, 46]);
    expect(ascentDescent(heights).ascentM).toBe(46);
  });

  it('gives null when an altitude is missing (all or nothing)', () => {
    expect(
      climbProfile([
        [0, 100],
        [30, null],
      ]),
    ).toBeNull();
    expect(climbProfile([])).toBeNull();
  });
});

describe('remainingClimbM', () => {
  const climb = climbProfile(profile);

  it('is the whole ascent at the start, 0 at the end, and never goes up', () => {
    expect(remainingClimbM(climb, line, initialPlacement())).toBe(46);
    expect(remainingClimbM(climb, line, on(0))).toBe(46);
    expect(remainingClimbM(climb, line, on(2400))).toBe(0);
    let before = Infinity;
    for (let m = 0; m <= 2400; m += 25) {
      const left = remainingClimbM(climb, line, on(m)) as number;
      expect(left).toBeLessThanOrEqual(before);
      before = left;
    }
  });

  it('gives the value of the profile at the same share of the length', () => {
    // 600 m of 2 400: the third point of the profile (+10): 36 m left
    expect(remainingClimbM(climb, line, on(600))).toBe(36);
    // 1 500 m: the sixth point (+16 counted): 20 m left
    expect(remainingClimbM(climb, line, on(1500))).toBe(20);
  });

  it('puts the profile axis on the line axis when they differ by a few meters', () => {
    const longer = climbProfile(profile.map(([d, h]) => [d * 1.01, h]));
    expect(remainingClimbM(longer, line, on(1500))).toBe(20);
    expect(remainingClimbM(longer, line, on(2400))).toBe(0);
  });

  it('uses the target when off the track, and gives null without altitudes', () => {
    const off: Placement = { ...on(300), phase: 'offTrack', targetM: 1500 };
    expect(remainingClimbM(climb, line, off)).toBe(20);
    expect(remainingClimbM(null, line, on(300))).toBeNull();
  });
});
