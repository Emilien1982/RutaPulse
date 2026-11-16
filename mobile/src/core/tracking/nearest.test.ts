import { bestInWindow, nearestOnLine, passagesNear } from './nearest';
import { buildLine } from './trackingLine';
import {
  dense,
  lineOf,
  outAndBack,
  switchbacks,
  toLonLat,
} from './testing/fabricate';

describe('nearestOnLine', () => {
  const line = buildLine(
    lineOf([
      [0, 0],
      [1000, 0],
      [1000, 500],
    ]),
  );

  it('gives the distance along the line, the gap and the bearing', () => {
    const found = nearestOnLine(line, toLonLat([400, 12]), 0, line.lengthM);
    expect(found?.alongM).toBeCloseTo(400, 0);
    expect(found?.gapM).toBeCloseTo(12, 0);
    expect(found?.bearing).toBeCloseTo(90, 0);
    const second = nearestOnLine(line, toLonLat([1030, 300]), 0, line.lengthM);
    expect(second?.alongM).toBeCloseTo(1300, 0);
    expect(second?.gapM).toBeCloseTo(30, 0);
    expect(second?.bearing).toBeCloseTo(0, 0);
  });

  it('stops at the ends of the line', () => {
    const before = nearestOnLine(line, toLonLat([-40, 30]), 0, line.lengthM);
    expect(before?.alongM).toBeCloseTo(0, 3);
    expect(before?.gapM).toBeCloseTo(50, 0);
  });

  it('looks only between the two distances', () => {
    // the point is at 400 m, but the search starts at 800 m (whole segments are read)
    const fine = buildLine(
      lineOf(
        dense([
          [0, 0],
          [1000, 0],
          [1000, 500],
        ]),
      ),
    );
    const found = nearestOnLine(fine, toLonLat([400, 10]), 800, 1200);
    expect(found?.alongM).toBeCloseTo(800, 0);
    expect(found?.gapM).toBeCloseTo(400, 0);
  });

  it('gives null for a line without segment', () => {
    expect(nearestOnLine(buildLine([[6, 48]]), [6, 48], 0, 10)).toBeNull();
  });
});

describe('passagesNear', () => {
  it('gives the two passages of an out-and-back, in the order of the line', () => {
    const line = buildLine(lineOf(dense(outAndBack(1000))));
    const found = passagesNear(line, toLonLat([600, 5]), 20);
    expect(found).toHaveLength(2);
    expect(found[0]?.alongM).toBeCloseTo(600, 0);
    expect(found[0]?.bearing).toBeCloseTo(90, 0);
    expect(found[1]?.alongM).toBeCloseTo(1400, 0);
    expect(found[1]?.bearing).toBeCloseTo(270, 0);
  });

  it('gives the two arms of a hairpin as two passages', () => {
    // arms 20 m apart, joined by a turn 20 m away from the point
    const line = buildLine(lineOf(switchbacks(300, 20, 2)));
    const found = passagesNear(line, toLonLat([150, 10]), 20);
    expect(found.map((n) => Math.round(n.alongM))).toEqual([150, 470]);
  });

  it('gives nothing when the line is farther than the radius', () => {
    const line = buildLine(lineOf(dense(outAndBack(1000))));
    expect(passagesNear(line, toLonLat([600, 40]), 20)).toEqual([]);
  });

  it('can look in a window of the line', () => {
    const line = buildLine(lineOf(dense(outAndBack(1000))));
    const found = passagesNear(line, toLonLat([600, 5]), 20, 1000, 2000);
    expect(found).toHaveLength(1);
    expect(found[0]?.alongM).toBeCloseTo(1400, 0);
  });
});

describe('bestInWindow', () => {
  it('chooses the passage that follows the movement', () => {
    const line = buildLine(lineOf(switchbacks(300, 20, 2)));
    const point = toLonLat([150, 10]);
    // 150 m expected: the first arm; 450 m expected: the second one
    expect(bestInWindow(line, point, 0, 700, 160, 30)?.alongM).toBeCloseTo(
      150,
      0,
    );
    expect(bestInWindow(line, point, 0, 700, 460, 30)?.alongM).toBeCloseTo(
      470,
      0,
    );
  });

  it('gives null when nothing is within the gap', () => {
    const line = buildLine(lineOf(dense(outAndBack(1000))));
    expect(
      bestInWindow(line, toLonLat([600, 50]), 0, 2000, 600, 30),
    ).toBeNull();
  });
});
