import { mapColors } from '@/ui/theme';

import { buildMapStyle, zoneBorderGeoJson } from './mapStyle';

const bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };
const style = buildMapStyle({
  files: {
    map: 'file:///doc/zones/nancy/v3/map.pmtiles',
    terrain: 'file:///doc/zones/nancy/v3/terrain.pmtiles',
    contours: 'file:///doc/zones/nancy/v3/contours.pmtiles',
  },
  glyphsDir: 'file:///doc/glyphs/1',
  bbox,
});

// The style is plain JSON: read it without the library types.
type AnyLayer = {
  id: string;
  type: string;
  source?: string;
  minzoom?: number;
  filter?: unknown;
  paint?: Record<string, unknown>;
};
const layers = style.layers as unknown as AnyLayer[];
const layer = (id: string) => {
  const found = layers.find((l) => l.id === id);
  if (!found) throw new Error(`No layer ${id}`);
  return found;
};
const text = (value: unknown) => JSON.stringify(value);

describe('buildMapStyle sources', () => {
  it('reads the three files of the zone, as local PMTiles', () => {
    const sources = style.sources as unknown as Record<
      string,
      { url?: string }
    >;
    expect(sources.carte.url).toBe(
      'pmtiles://file:///doc/zones/nancy/v3/map.pmtiles',
    );
    expect(sources.relief.url).toBe(
      'pmtiles://file:///doc/zones/nancy/v3/terrain.pmtiles',
    );
    expect(sources.courbes.url).toBe(
      'pmtiles://file:///doc/zones/nancy/v3/contours.pmtiles',
    );
  });

  it('has no network address at all', () => {
    expect(text(style)).not.toMatch(/https?:/);
  });

  it('reads the glyphs from a local folder', () => {
    expect(style.glyphs).toBe('file:///doc/glyphs/1/{fontstack}/{range}.pbf');
  });
});

describe('buildMapStyle layers', () => {
  it('has unique ids and only known sources', () => {
    const ids = layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sources = Object.keys(style.sources);
    for (const l of layers) {
      if (l.source) expect(sources).toContain(l.source);
    }
  });

  it('draws the contours from zoom 13', () => {
    expect(layer('courbe').minzoom).toBe(13);
    expect(layer('courbe-maitresse').minzoom).toBe(13);
  });

  it('takes its colors from the theme', () => {
    expect(layer('fond').paint?.['background-color']).toBe(
      mapColors.background,
    );
    expect(layer('sentier').paint?.['line-color']).toBe(mapColors.path);
    expect(layer('piste').paint?.['line-color']).toBe(mapColors.track);
    expect(layer('voie-g').paint?.['line-color']).toBe(mapColors.road);
    expect(layer('voie-g-bord').paint?.['line-color']).toBe(
      mapColors.roadCasing,
    );
  });

  it('keeps footways (sidewalks) out of the trails', () => {
    const trail = text(layer('sentier').filter);
    expect(trail).toContain('bridleway');
    expect(trail).not.toContain('footway');
    expect(trail).not.toContain('pedestrian');
    expect(trail).not.toContain('steps');
    // Also not in the tracks nor in the roads.
    expect(text(layer('piste').filter)).not.toContain('footway');
    expect(text(layer('voie-s').filter)).not.toContain('footway');
  });

  it('draws footways as a thin line, from zoom 16 only', () => {
    const footway = layer('pieton');
    expect(footway.minzoom).toBe(16);
    expect(text(footway.filter)).toContain('footway');
    expect(footway.paint?.['line-color']).toBe(mapColors.footway);
    expect(footway.paint).not.toHaveProperty('line-dasharray');
  });

  it('draws trails as red dashes and tracks as full lines', () => {
    expect(layer('sentier').paint).toHaveProperty('line-dasharray');
    expect(layer('piste').paint).not.toHaveProperty('line-dasharray');
  });

  it('draws the roads casings under the tracks, the white over them', () => {
    const order = layers.map((l) => l.id);
    expect(order.indexOf('voie-g-bord')).toBeLessThan(order.indexOf('piste'));
    expect(order.indexOf('sentier')).toBeLessThan(order.indexOf('voie-s'));
  });
});

describe('zone border', () => {
  it('is a line layer made from the bbox of the zone', () => {
    const border = layer('bord-zone');
    expect(border.type).toBe('line');
    expect(border.paint?.['line-color']).toBe(mapColors.zoneBorder);
    expect(border.paint?.['line-width']).toBe(2.5);
    // Dashes 9 / 6 points, counted in multiples of the width.
    expect(border.paint?.['line-dasharray']).toEqual([3.6, 2.4]);
    const source = (
      style.sources as unknown as Record<
        string,
        { type: string; data: ReturnType<typeof zoneBorderGeoJson> }
      >
    )['bord-zone'];
    expect(source.type).toBe('geojson');
    expect(source.data.geometry.coordinates).toEqual([
      [5.84, 48.47],
      [6.52, 48.47],
      [6.52, 48.92],
      [5.84, 48.92],
      [5.84, 48.47],
    ]);
  });

  it('is above the roads and below the labels', () => {
    const order = layers.map((l) => l.id);
    expect(order.indexOf('bord-zone')).toBeGreaterThan(order.indexOf('voie-g'));
    expect(order.indexOf('bord-zone')).toBeLessThan(order.indexOf('cote'));
  });
});
