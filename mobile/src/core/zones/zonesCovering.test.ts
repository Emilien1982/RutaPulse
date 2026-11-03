import type { Zone } from './catalogue';
import { zonesCovering } from './zonesCovering';

const zone = (id: string, lonMin: number, lonMax: number): Zone => ({
  id,
  name: id,
  version: 1,
  bbox: { lonMin, lonMax, latMin: 48, latMax: 49 },
  osmDate: '2026-10-01',
  totalBytes: 1,
  files: [],
});

describe('zonesCovering', () => {
  const zones = [
    zone('nancy', 6, 7),
    zone('metz', 6.1, 6.3),
    zone('far', 2, 3),
  ];

  it('keeps the zones whose rectangle holds the point', () => {
    expect(zonesCovering(zones, 6.2, 48.5).map((z) => z.id)).toEqual([
      'nancy',
      'metz',
    ]);
  });

  it('counts the edges', () => {
    expect(zonesCovering(zones, 2, 49).map((z) => z.id)).toEqual(['far']);
  });

  it('gives nothing outside every zone', () => {
    expect(zonesCovering(zones, 10, 10)).toEqual([]);
  });
});
