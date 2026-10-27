// Tests written from the decisions of the Product Owner (T5):
// the camera center stays in the bbox; "Recenter" outside the zone goes to
// the closest point of the zone.
import { clampToBbox, isInsideBbox } from './activeZone';

const nancy = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };

describe('closest point of the zone', () => {
  it('general case, computed by hand: (7.00; 48.00) gives (6.52; 48.47)', () => {
    // lon 7.00 > lonMax 6.52 -> 6.52 ; lat 48.00 < latMin 48.47 -> 48.47.
    // On a rectangle, the closest point is obtained axis by axis.
    expect(clampToBbox(nancy, 7.0, 48.0)).toEqual([6.52, 48.47]);
  });

  it('general case, one axis only: Paris (2.35; 48.85) gives (5.84; 48.85)', () => {
    // lon 2.35 < 5.84 -> 5.84 ; lat 48.85 is between 48.47 and 48.92 -> kept.
    expect(clampToBbox(nancy, 2.35, 48.85)).toEqual([5.84, 48.85]);
  });

  it('general case: Metz (6.1757; 49.1193) gives (6.1757; 48.92)', () => {
    expect(clampToBbox(nancy, 6.1757, 49.1193)).toEqual([6.1757, 48.92]);
  });

  it('keeps a point inside as it is', () => {
    expect(clampToBbox(nancy, 6.1844, 48.6921)).toEqual([6.1844, 48.6921]);
  });

  it('the result is never farther than any other corner or edge point', () => {
    const p: [number, number] = [7.0, 48.0];
    const q = clampToBbox(nancy, p[0], p[1]);
    const d = (a: number[]) => Math.hypot(a[0] - p[0], a[1] - p[1]);
    for (const other of [
      [nancy.lonMin, nancy.latMin],
      [nancy.lonMax, nancy.latMin],
      [nancy.lonMax, nancy.latMax],
      [nancy.lonMin, nancy.latMax],
      [6.52, 48.7],
      [6.2, 48.47],
    ]) {
      expect(d(q)).toBeLessThanOrEqual(d(other) + 1e-12);
    }
  });
});

describe('center in the bbox', () => {
  it('the clamped point is always inside', () => {
    for (const [lon, lat] of [
      [-180, -90],
      [180, 90],
      [6.2, 100],
      [0, 48.6],
    ]) {
      const [x, y] = clampToBbox(nancy, lon, lat);
      expect(isInsideBbox(nancy, x, y)).toBe(true);
    }
  });

  it('isInsideBbox: edges in, just outside out', () => {
    expect(isInsideBbox(nancy, 5.84, 48.47)).toBe(true);
    expect(isInsideBbox(nancy, 6.52, 48.92)).toBe(true);
    expect(isInsideBbox(nancy, 6.5201, 48.6)).toBe(false);
    expect(isInsideBbox(nancy, 6.2, 48.4699)).toBe(false);
  });
});
