import { axisTicks, chartPoints, MIN_SPAN_M } from './chart';

describe('chartPoints', () => {
  const profile: [number, number][] = [
    [0, 100],
    [1000, 130],
    [2000, 115],
  ];

  it('puts the lowest altitude at the bottom and the highest at the top', () => {
    const points = chartPoints(profile, 100, 130, 358, 84);
    expect(points[0]?.y).toBeCloseTo(81); // 84 - margin of 3
    expect(points[1]?.y).toBeCloseTo(3);
    expect(points[2]?.y).toBeCloseTo(81 - (15 / 30) * 78);
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
    expect(points[1]?.y).toBeCloseTo(81 - (2 / MIN_SPAN_M) * 78);
  });

  it('does not divide by zero when the profile has no length', () => {
    expect(chartPoints([[0, 100]], 100, 100, 358, 84)).toEqual([
      { x: 0, y: 81 },
    ]);
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
