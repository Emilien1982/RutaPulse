// Tests written from the spec p02 (C6, C7), design/style-carte.md.
import { mapColors } from '@/ui/theme';

import { buildMapStyle, MAX_ZOOM, MIN_ZOOM } from './mapStyle';

const style = buildMapStyle({
  files: {
    map: 'file:///doc/zones/nancy/v3/map.pmtiles',
    terrain: 'file:///doc/zones/nancy/v3/terrain.pmtiles',
    contours: 'file:///doc/zones/nancy/v3/contours.pmtiles',
  },
  glyphsDir: 'file:///doc/glyphs/1',
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
});

type L = {
  id: string;
  type: string;
  source?: string;
  minzoom?: number;
  filter?: unknown;
  paint?: Record<string, unknown>;
};
const layers = style.layers as unknown as L[];
const json = (v: unknown) => JSON.stringify(v);
const usingColor = (color: string) =>
  layers.filter((l) => Object.values(l.paint ?? {}).includes(color));

describe('C6 - zoom range and no network', () => {
  it('goes from zoom 8 to zoom 18', () => {
    expect(MIN_ZOOM).toBe(8);
    expect(MAX_ZOOM).toBe(18);
  });

  it('contains no http(s) address anywhere (airplane mode)', () => {
    expect(json(style)).not.toMatch(/https?:/i);
  });

  it('reads every vector or raster source from a file: address', () => {
    const sources = style.sources as unknown as Record<
      string,
      { url?: string; type: string }
    >;
    for (const s of Object.values(sources)) {
      if (s.url) expect(s.url).toMatch(/^pmtiles:\/\/file:\/\//);
    }
  });
});

describe('C7 - sidewalks are not trails', () => {
  it('no layer drawn with the trail color accepts footway or pedestrian', () => {
    const trailLayers = usingColor(mapColors.path);
    expect(trailLayers.length).toBeGreaterThan(0);
    for (const l of trailLayers) {
      expect(json(l.filter)).not.toMatch(/footway|pedestrian/);
    }
  });

  it('no layer drawn with the track color accepts footway or pedestrian', () => {
    for (const l of usingColor(mapColors.track)) {
      expect(json(l.filter)).not.toMatch(/footway|pedestrian/);
    }
  });

  it('footways and pedestrian ways, when drawn, are not red', () => {
    const drawn = layers.filter((l) =>
      /footway|pedestrian/.test(json(l.filter)),
    );
    for (const l of drawn) {
      expect(l.paint?.['line-color']).not.toBe(mapColors.path);
      expect(l.paint?.['line-color']).not.toBe(mapColors.track);
    }
  });
});

describe('C7 - contours from zoom 13', () => {
  it('every contour layer starts at zoom 13 or earlier', () => {
    const contours = layers.filter(
      (l) => l.type === 'line' && l.source === 'courbes',
    );
    expect(contours.length).toBeGreaterThanOrEqual(2);
    for (const l of contours) {
      expect(l.minzoom).toBeDefined();
      expect(l.minzoom as number).toBeLessThanOrEqual(13);
    }
  });
});

describe('C7 - tracks, trails and roads are distinct layers', () => {
  const byColor = (c: string) => usingColor(c).map((l) => l.id);

  it('has three disjoint sets of layers with three colors', () => {
    const tracks = byColor(mapColors.track);
    const trails = byColor(mapColors.path);
    const roads = byColor(mapColors.road);
    expect(tracks.length).toBeGreaterThan(0);
    expect(trails.length).toBeGreaterThan(0);
    expect(roads.length).toBeGreaterThan(0);
    for (const id of tracks) {
      expect(trails).not.toContain(id);
      expect(roads).not.toContain(id);
    }
    for (const id of trails) expect(roads).not.toContain(id);
    expect(
      new Set([mapColors.track, mapColors.path, mapColors.road]).size,
    ).toBe(3);
  });

  it('trails are dashed, tracks and roads are full lines', () => {
    for (const l of usingColor(mapColors.path))
      expect(l.paint).toHaveProperty('line-dasharray');
    for (const l of usingColor(mapColors.track))
      expect(l.paint).not.toHaveProperty('line-dasharray');
    for (const l of usingColor(mapColors.road))
      expect(l.paint).not.toHaveProperty('line-dasharray');
  });

  it('trails are thinner than tracks at zoom 15 (2 vs 2.5, style-carte.md)', () => {
    const at15 = (l: L) => {
      const w = l.paint?.['line-width'] as unknown[];
      // ['interpolate', ['linear'], ['zoom'], z1, w1, z2, w2, ...]
      const i = w.indexOf(15);
      return w[i + 1] as number;
    };
    expect(at15(usingColor(mapColors.path)[0])).toBe(2);
    expect(at15(usingColor(mapColors.track)[0])).toBe(2.5);
  });
});
