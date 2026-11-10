import { trackLengthM } from '@/core/gpx/trackLengthM';

import type { LonLat } from './savedRoute';
import { spaceEvery } from './track';

// 0.01 degree of latitude is 1 113.19 m on the sphere of the engine
// (6 378 160 m x 0.01 x pi / 180).
const meridian: LonLat[] = [
  [6, 48],
  [6, 48.01],
];

describe('spaceEvery', () => {
  it('gives the ends and a point every 20 m on a straight line', () => {
    const out = spaceEvery(meridian, 20);
    // 55 points at 20, 40... 1 100 m, and the two ends
    expect(out).toHaveLength(57);
    expect(out[0]).toEqual([6, 48]);
    expect(out[56]).toEqual([6, 48.01]);
    for (let i = 1; i < 56; i++) {
      expect(
        trackLengthM([out[i - 1] as LonLat, out[i] as LonLat]),
      ).toBeCloseTo(20, 1);
    }
  });

  it('keeps the length of a line that turns', () => {
    const line: LonLat[] = [
      [6, 48],
      [6, 48.002],
      [6.003, 48.002],
    ];
    const out = spaceEvery(line, 20);
    // 222.6 m north then 223.2 m east: the length is kept within one step
    expect(Math.abs(trackLengthM(out) - trackLengthM(line))).toBeLessThan(20);
    expect(out[out.length - 1]).toEqual(line[2]);
  });

  it('counts the length walked across the points of the line', () => {
    // points every 8 m: the next point is 20 m from the last one written
    const dense: LonLat[] = [];
    for (let i = 0; i <= 50; i++) dense.push([6, 48 + (i * 8) / 111_319.5]);
    const out = spaceEvery(dense, 20);
    expect(out.length).toBeGreaterThanOrEqual(21);
    expect(out.length).toBeLessThanOrEqual(22);
  });

  it('copes with one point, no point, and a repeated point', () => {
    expect(spaceEvery([], 20)).toEqual([]);
    expect(spaceEvery([[6, 48]], 20)).toEqual([[6, 48]]);
    expect(
      spaceEvery(
        [
          [6, 48],
          [6, 48],
        ],
        20,
      ),
    ).toEqual([[6, 48]]);
  });
});
