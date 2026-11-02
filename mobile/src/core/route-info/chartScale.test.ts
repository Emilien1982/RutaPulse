import { chartPoints, profileScale } from './chart';

describe('profileScale', () => {
  it('shows at least 100 m, with 12 % under the lowest point', () => {
    const { lowM, spanM } = profileScale(202, 240);
    expect(spanM).toBeCloseTo(100 / 0.85);
    expect(lowM).toBeCloseTo(202 - 0.12 * spanM);
  });

  // Values worked out by hand: span 145 / 0.85 = 170.59, low 245 - 20.47.
  it('gives 225 to 395 m for 245 to 390 m (mockup 20)', () => {
    const { lowM, spanM } = profileScale(245, 390);
    expect(lowM).toBeCloseTo(224.5, 1);
    expect(lowM + spanM).toBeCloseTo(395.1, 1);
  });
});

describe('chartPoints', () => {
  // 38 m on a scale of 117.65 m: y = 84 - (alt - 187.88) / 117.65 * 84.
  it('draws 38 m in the lower part of the chart', () => {
    const points = chartPoints(
      [
        [0, 202],
        [1000, 240],
      ],
      202,
      240,
      358,
      84,
    );
    expect(points[0]?.y).toBeCloseTo(73.9, 1);
    expect(points[1]?.y).toBeCloseTo(46.8, 1);
  });
});
