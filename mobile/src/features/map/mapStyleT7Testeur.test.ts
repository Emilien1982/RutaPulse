import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import { buildMapStyle } from './mapStyle';

// B6, from design/style-carte.md, "Bord de la zone et voile", layers 31, 32.
const bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };
const style = buildMapStyle({
  files: { map: 'a', terrain: 'b', contours: 'c' },
  glyphsDir: 'file:///g',
  bbox,
}) as StyleSpecification;
type L = {
  id: string;
  type: string;
  source: string;
  filter?: unknown;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};
const layers = style.layers as unknown as L[];
const ids = layers.map((l) => l.id);
type Geo = { type: string; coordinates: number[][][] | number[][] };
const features = (source: string): Geo[] => {
  const data = (style.sources as Record<string, { data: unknown }>)[source]
    .data as { type: string; geometry?: Geo; features?: { geometry: Geo }[] };
  return data.type === 'FeatureCollection'
    ? data.features!.map((f) => f.geometry)
    : [data.geometry!];
};
// Signed area (shoelace): positive when counter-clockwise.
const area = (ring: number[][]) =>
  ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + (p[0] * q[1] - q[0] * p[1]);
  }, 0) / 2;

describe('B6 veil and border', () => {
  const veil = layers.find((l) => l.id === 'voile-hors-zone')!;
  const border = layers.find((l) => l.id === 'bord-zone')!;

  it('has a fill veil #CFC8BB at 0.72', () => {
    expect(veil.type).toBe('fill');
    expect(String(veil.paint?.['fill-color']).toUpperCase()).toBe('#CFC8BB');
    expect(veil.paint?.['fill-opacity']).toBe(0.72);
  });

  it('puts the veil then the border over every other layer', () => {
    expect(ids.slice(-2)).toEqual(['voile-hors-zone', 'bord-zone']);
    expect(ids.filter((i) => i === 'voile-hors-zone')).toHaveLength(1);
  });

  it('builds the veil from the world with a hole at the bbox', () => {
    const polygon = features(veil.source).find((g) => g.type === 'Polygon')!;
    const [outer, hole] = polygon.coordinates as number[][][];
    const lons = outer.map((p) => p[0]);
    const lats = outer.map((p) => p[1]);
    expect([Math.min(...lons), Math.max(...lons)]).toEqual([-180, 180]);
    expect([Math.min(...lats), Math.max(...lats)]).toEqual([-85, 85]);
    expect(hole[0]).toEqual(hole[hole.length - 1]);
    const hl = hole.map((p) => p[0]);
    const ha = hole.map((p) => p[1]);
    expect([Math.min(...hl), Math.max(...hl)]).toEqual([5.84, 6.52]);
    expect([Math.min(...ha), Math.max(...ha)]).toEqual([48.47, 48.92]);
    // The hole goes the other way round than the outer ring.
    expect(Math.sign(area(hole))).toBe(-Math.sign(area(outer)));
    expect(Math.abs(area(hole))).toBeCloseTo(0.68 * 0.45, 6);
  });

  it('draws the border as a closed line of the four sides', () => {
    expect(border.type).toBe('line');
    const line = features(border.source).find((g) => g.type === 'LineString')!;
    const c = line.coordinates as number[][];
    expect(c).toHaveLength(5);
    expect(c[0]).toEqual(c[4]);
    expect(new Set(c.map((p) => p.join())).size).toBe(4);
    expect(border.paint?.['line-width']).toBe(2.5);
    expect(border.paint?.['line-dasharray']).toEqual([3.6, 2.4]);
    // style-carte.md, "Règles communes": bouts carrés = `line-cap: butt`
    // (with `square` the dashes would be 11.5 / 3.5 instead of 9 / 6).
    expect(border.layout?.['line-cap']).toBe('butt');
  });

  it('shows both layers at all zooms, 8 to 18', () => {
    for (const l of [veil, border]) {
      expect(l).not.toHaveProperty('minzoom');
      expect(l).not.toHaveProperty('maxzoom');
    }
  });
});
