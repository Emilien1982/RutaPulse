import { distanceMeters, linkSegments } from './routeLink';

describe('distanceMeters', () => {
  it('gives 111.195 km for one degree of latitude (R = 6371.0088 km)', () => {
    const d = distanceMeters({ lon: 0, lat: 0 }, { lon: 0, lat: 1 });
    expect(d / 1000).toBeCloseTo(111.195, 2);
  });

  it('gives about 343.6 km from Paris to London (published figure ~344 km)', () => {
    const d = distanceMeters(
      { lon: 2.3522, lat: 48.8566 },
      { lon: -0.1278, lat: 51.5074 },
    );
    expect(d / 1000).toBeGreaterThan(342);
    expect(d / 1000).toBeLessThan(345);
  });

  it('is zero for the same point', () => {
    expect(distanceMeters({ lon: 6, lat: 48 }, { lon: 6, lat: 48 })).toBe(0);
  });
});

describe('linkSegments', () => {
  const shape: [number, number][] = [
    [6.1, 48.6],
    [6.11, 48.61],
    [6.12, 48.62],
  ];

  it('links start to the first point and the last point to the end', () => {
    const start = { lon: 6.1, lat: 48.601 };
    const end = { lon: 6.12, lat: 48.621 };
    expect(linkSegments(start, end, shape)).toEqual([
      [
        [6.1, 48.601],
        [6.1, 48.6],
      ],
      [
        [6.12, 48.62],
        [6.12, 48.621],
      ],
    ]);
  });

  it('leaves out a segment under 5 m (3.3 m left out, 6.7 m kept)', () => {
    const near = { lon: 6.1, lat: 48.60003 };
    const far = { lon: 6.12, lat: 48.62006 };
    const result = linkSegments(near, far, shape);
    expect(result).toEqual([
      [
        [6.12, 48.62],
        [6.12, 48.62006],
      ],
    ]);
  });

  it('gives nothing when both points are on the route', () => {
    expect(
      linkSegments({ lon: 6.1, lat: 48.6 }, { lon: 6.12, lat: 48.62 }, shape),
    ).toEqual([]);
  });

  it('gives nothing for an empty shape', () => {
    expect(
      linkSegments({ lon: 6, lat: 48 }, { lon: 6.1, lat: 48.1 }, []),
    ).toEqual([]);
  });
});
