import { mapColors } from '@/ui/theme';

import { buildMapStyle, zoneVeilGeoJson } from './mapStyle';

const bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };
const style = buildMapStyle({
  files: { map: 'a', terrain: 'b', contours: 'c' },
  glyphsDir: 'file:///doc/glyphs/1',
  bbox,
});
type AnyLayer = {
  id: string;
  type: string;
  source?: string;
  paint?: Record<string, unknown>;
};
const order = (style.layers as unknown as AnyLayer[]).map((l) => l.id);
const layers = style.layers as unknown as AnyLayer[];

describe('veil outside the zone', () => {
  it('is a polygon of the world with a hole at the zone', () => {
    const { geometry } = zoneVeilGeoJson(bbox);
    expect(geometry.type).toBe('Polygon');
    expect(geometry.coordinates[0][0]).toEqual([-180, -85]);
    expect(geometry.coordinates[0][2]).toEqual([180, 85]);
    expect(geometry.coordinates[1]).toEqual([
      [5.84, 48.47],
      [5.84, 48.92],
      [6.52, 48.92],
      [6.52, 48.47],
      [5.84, 48.47],
    ]);
  });

  it('is a fill layer with the token color and opacity', () => {
    const veil = layers.find((l) => l.id === 'voile-hors-zone');
    expect(veil?.type).toBe('fill');
    expect(veil?.paint?.['fill-color']).toBe(mapColors.outsideVeil);
    expect(mapColors.outsideVeil).toBe('#CFC8BB');
    expect(veil?.paint?.['fill-opacity']).toBe(0.72);
    const sources = style.sources as unknown as Record<string, unknown>;
    expect(sources[veil?.source ?? '']).toBeDefined();
  });

  it('is on top of every layer, with the border above the veil', () => {
    expect(order.slice(-2)).toEqual(['voile-hors-zone', 'bord-zone']);
    expect(order.indexOf('voile-hors-zone')).toBeGreaterThan(
      order.indexOf('lieu-ville'),
    );
  });
});
