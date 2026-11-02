import { axisTicks, chartPoints, MIN_SPAN_M } from './chart';

describe('chartPoints', () => {
  const profile: [number, number][] = [
    [0, 100],
    [1000, 130],
    [2000, 115],
  ];

  // p05-t8 C7: shown span = max(span, 100 m) / 0.85 = 117,647 m; the scale
  // starts 12 % of it under the lowest altitude (85,882 m).
  it('keeps 12 % of room under the lowest altitude, more above the highest', () => {
    const points = chartPoints(profile, 100, 130, 358, 84);
    expect(points[0]?.y).toBeCloseTo(84 * 0.88); // 12 % of 84 under 100 m
    expect(points[1]?.y).toBeCloseTo(84 - (44.1176 / 117.647) * 84);
    expect(points[2]?.y).toBeCloseTo(84 - (29.1176 / 117.647) * 84);
  });

  it('spreads the distance over the whole width', () => {
    const points = chartPoints(profile, 100, 130, 358, 84);
    expect(points.map((p) => p.x)).toEqual([0, 179, 358]);
  });

  it('keeps a flat route flat: the span never goes under the minimum', () => {
    const points = chartPoints(
      [
        [0, 200],
        [500, 202],
      ],
      200,
      202,
      358,
      84,
    );
    // 200 -> 202 m on a scale of 117,647 m starting at 185,882 m.
    expect(MIN_SPAN_M).toBe(100);
    expect(points[1]?.y).toBeCloseTo(84 - (16.1176 / 117.647) * 84);
  });

  it('does not divide by zero when the profile has no length', () => {
    const [point] = chartPoints([[0, 100]], 100, 100, 358, 84);
    expect(point?.x).toBe(0);
    expect(point?.y).toBeCloseTo(84 * 0.88);
    expect(chartPoints([], 0, 0, 358, 84)).toEqual([]);
  });
});

describe('axisTicks', () => {
  it('gives 0, then a round step, about 5 intervals', () => {
    expect(axisTicks(25.1)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(axisTicks(3)).toEqual([0, 1, 2, 3]);
    expect(axisTicks(0.6)).toEqual([0, 0.2, 0.4, 0.6]);
  });

  it('is [0] when there is no length', () => {
    expect(axisTicks(0)).toEqual([0]);
    expect(axisTicks(Number.NaN)).toEqual([0]);
  });
});
