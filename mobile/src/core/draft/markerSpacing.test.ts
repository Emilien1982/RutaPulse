import { discreteMarkers, medianGapPx } from './markerSpacing';

const points = (n: number, step: number) =>
  Array.from({ length: n }, (_, i) => ({ lon: 6 + i * step, lat: 48.6 }));

describe('numbered or discrete markers', () => {
  it('measures the median gap on the screen', () => {
    // 0.001 degree at zoom 15: 512 * 2^15 / 360 * 0.001 = 46.6 points.
    expect(medianGapPx(points(5, 0.001), 15)).toBeCloseTo(46.6, 0);
  });

  it('is discrete when the points are closer than 44 points, numbered above', () => {
    expect(discreteMarkers(points(35, 0.001), 12)).toBe(true);
    expect(discreteMarkers(points(35, 0.001), 15)).toBe(false);
  });

  it('is numbered with fewer than two points', () => {
    expect(discreteMarkers(points(1, 0.001), 5)).toBe(false);
  });
});
