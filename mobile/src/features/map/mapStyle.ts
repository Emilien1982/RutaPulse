// The map style of design/style-carte.md, as a MapLibre style object.
// Every source is a local file: no network address (C6, ADR 0013 section 8).

import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import type { Bbox } from '@/core/zones/catalogue';
import { mapColors as c } from '@/ui/theme';

export type MapStyleInput = {
  /** `file://` addresses of the zone files. */
  files: { map: string; terrain: string; contours: string };
  /** `file://` address of the glyphs folder (contains the font folders). */
  glyphsDir: string;
  bbox: Bbox;
};

type Json = unknown;
type Layer = Record<string, Json>;

export const MIN_ZOOM = 8;
export const MAX_ZOOM = 18;

// Width by zoom: linear interpolation between the given points.
function widths(...points: Json[]): Json {
  return ['interpolate', ['linear'], ['zoom'], ...points];
}

const get = (name: string): Json => ['get', name];
const eq = (name: string, value: string | number): Json => [
  '==',
  get(name),
  value,
];
const ne = (name: string, value: string): Json => ['!=', get(name), value];
const oneOf = (name: string, values: string[]): Json => [
  'in',
  get(name),
  ['literal', values],
];

const LINE: Json = [
  'in',
  ['geometry-type'],
  ['literal', ['LineString', 'MultiLineString']],
];
const NOT_TUNNEL = ne('brunnel', 'tunnel');
const TUNNEL_OPACITY: Json = ['case', ['==', get('brunnel'), 'tunnel'], 0.4, 1];
const isPath: Json = eq('class', 'path');
const unpaved = eq('surface', 'unpaved');

const GROUP_G: Json = [
  'all',
  LINE,
  oneOf('class', ['motorway', 'trunk', 'primary']),
];
const GROUP_M: Json = ['all', LINE, oneOf('class', ['secondary', 'tertiary'])];
const GROUP_P: Json = ['all', LINE, oneOf('class', ['minor', 'busway'])];
const GROUP_S: Json = [
  'all',
  LINE,
  [
    'any',
    eq('class', 'service'),
    ['all', isPath, eq('subclass', 'cycleway'), ne('surface', 'unpaved')],
    [
      'all',
      isPath,
      oneOf('subclass', ['path', 'bridleway']),
      eq('surface', 'paved'),
    ],
  ],
];

const ROUND = { 'line-cap': 'round', 'line-join': 'round' };

function transport(
  id: string,
  minzoom: number,
  filter: Json,
  layout: Json,
  paint: Record<string, Json>,
): Layer {
  return {
    id,
    type: 'line',
    source: 'carte',
    'source-layer': 'transportation',
    minzoom,
    filter,
    layout,
    paint,
  };
}

function road(
  id: string,
  minzoom: number,
  filter: Json,
  color: string,
  width: Json,
): Layer {
  return transport(id, minzoom, filter, ROUND, {
    'line-color': color,
    'line-opacity': TUNNEL_OPACITY,
    'line-width': width,
  });
}

function fill(
  id: string,
  layer: string,
  filter: Json | undefined,
  color: string,
  minzoom?: number,
): Layer {
  return {
    id,
    type: 'fill',
    source: 'carte',
    'source-layer': layer,
    ...(minzoom !== undefined && { minzoom }),
    ...(filter !== undefined && { filter }),
    paint: { 'fill-color': color },
  };
}

function label(
  id: string,
  source: string,
  sourceLayer: string,
  minzoom: number,
  filter: Json,
  layout: Record<string, Json>,
  paint: { color: string; halo: number },
): Layer {
  return {
    id,
    type: 'symbol',
    source,
    'source-layer': sourceLayer,
    minzoom,
    filter,
    layout,
    paint: {
      'text-color': paint.color,
      'text-halo-color': c.labelHalo,
      'text-halo-width': paint.halo,
    },
  };
}

function contour(id: string, major: 0 | 1, color: string, width: Json): Layer {
  return {
    id,
    type: 'line',
    source: 'courbes',
    'source-layer': 'contour',
    minzoom: 13,
    filter: eq('major', major),
    layout: { 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': width },
  };
}

function layers(zoneBorder: Layer): Layer[] {
  return [
    {
      id: 'fond',
      type: 'background',
      paint: { 'background-color': c.background },
    },
    fill(
      'prairie',
      'landcover',
      oneOf('class', ['grass', 'wetland']),
      c.meadow,
      10,
    ),
    fill('foret', 'landcover', eq('class', 'wood'), c.wood),
    fill(
      'bati',
      'landuse',
      oneOf('class', [
        'residential',
        'commercial',
        'industrial',
        'retail',
        'garages',
        'school',
        'college',
        'university',
        'kindergarten',
        'hospital',
      ]),
      c.built,
    ),
    fill(
      'eau',
      'water',
      ['all', ne('class', 'swimming_pool'), NOT_TUNNEL],
      c.water,
    ),
    {
      id: 'riviere',
      type: 'line',
      source: 'carte',
      'source-layer': 'waterway',
      minzoom: 8,
      filter: ['all', oneOf('class', ['river', 'canal']), NOT_TUNNEL],
      layout: ROUND,
      paint: {
        'line-color': c.water,
        'line-width': widths(8, 0.8, 12, 1.5, 14, 2.5, 16, 4, 18, 6),
      },
    },
    {
      id: 'ruisseau',
      type: 'line',
      source: 'carte',
      'source-layer': 'waterway',
      minzoom: 13,
      filter: ['all', oneOf('class', ['stream', 'drain', 'ditch']), NOT_TUNNEL],
      layout: ROUND,
      paint: {
        'line-color': c.stream,
        'line-width': widths(13, 0.6, 15, 1.2, 16, 1.5, 18, 2.5),
      },
    },
    {
      id: 'ombrage',
      type: 'hillshade',
      source: 'relief',
      paint: {
        'hillshade-exaggeration': widths(8, 0.5, 13, 0.45, 16, 0.35, 18, 0.3),
        'hillshade-illumination-direction': 315,
        'hillshade-illumination-anchor': 'viewport',
        'hillshade-shadow-color': c.hillshadeShadow,
        'hillshade-accent-color': c.hillshadeShadow,
        'hillshade-highlight-color': c.hillshadeLight,
      },
    },
    {
      ...fill('batiment', 'building', undefined, c.building, 14),
      paint: {
        'fill-color': c.building,
        'fill-opacity': widths(14, 0.5, 16, 1),
      },
    },
    contour('courbe', 0, c.contour, widths(13, 0.75, 15, 1, 17, 1.3, 18, 1.5)),
    contour(
      'courbe-maitresse',
      1,
      c.contourMajor,
      widths(13, 1.3, 15, 1.8, 17, 2.35, 18, 2.7),
    ),
    transport(
      'pieton',
      16,
      ['all', LINE, isPath, oneOf('subclass', ['footway', 'pedestrian'])],
      ROUND,
      { 'line-color': c.footway, 'line-width': widths(16, 0.75, 18, 1.5) },
    ),
    transport(
      'escalier',
      15,
      ['all', LINE, isPath, eq('subclass', 'steps')],
      { 'line-cap': 'butt', 'line-join': 'round' },
      {
        'line-color': c.steps,
        'line-dasharray': [0.3, 0.3],
        'line-width': widths(15, 3, 16, 3.5, 18, 5),
      },
    ),
    transport(
      'rail',
      10,
      ['all', LINE, eq('class', 'rail'), NOT_TUNNEL],
      {},
      {
        'line-color': c.rail,
        'line-width': widths(10, 0.6, 14, 1.2, 16, 1.8, 18, 2.5),
      },
    ),
    road(
      'voie-s-bord',
      13,
      GROUP_S,
      c.roadCasing,
      widths(13, 1.5, 14, 2.5, 15, 3.5, 16, 4.5, 18, 8),
    ),
    road(
      'voie-p-bord',
      12,
      GROUP_P,
      c.roadCasing,
      widths(12, 1.4, 13, 2.5, 14, 4, 15, 5.5, 16, 7, 18, 12.5),
    ),
    road(
      'voie-m-bord',
      9,
      GROUP_M,
      c.roadCasing,
      widths(9, 1.4, 12, 3, 14, 5.75, 15, 7.5, 16, 9.5, 18, 16),
    ),
    road(
      'voie-g-bord',
      8,
      GROUP_G,
      c.roadCasing,
      widths(8, 1.8, 10, 2.5, 12, 4, 14, 7, 15, 9.5, 16, 12, 18, 20),
    ),
    road(
      'piste',
      12,
      [
        'all',
        LINE,
        [
          'any',
          eq('class', 'track'),
          ['all', isPath, eq('subclass', 'cycleway'), unpaved],
        ],
      ],
      c.track,
      widths(12, 1.5, 14, 2.2, 15, 2.5, 17, 3.25, 18, 3.75),
    ),
    transport(
      'sentier',
      12,
      [
        'all',
        LINE,
        isPath,
        oneOf('subclass', ['path', 'bridleway']),
        ne('surface', 'paved'),
      ],
      { 'line-cap': 'butt', 'line-join': 'round' },
      {
        'line-color': c.path,
        'line-opacity': TUNNEL_OPACITY,
        'line-dasharray': [2.5, 2],
        'line-width': widths(12, 1.2, 14, 1.75, 15, 2, 17, 2.6, 18, 3),
      },
    ),
    road(
      'voie-s',
      13,
      GROUP_S,
      c.road,
      widths(13, 0.75, 14, 1.5, 15, 2.25, 16, 3, 18, 6),
    ),
    road(
      'voie-p',
      12,
      GROUP_P,
      c.road,
      widths(12, 0.8, 13, 1.5, 14, 2.5, 15, 3.75, 16, 5, 18, 10),
    ),
    road(
      'voie-m',
      9,
      GROUP_M,
      c.road,
      widths(9, 0.8, 12, 1.8, 14, 4, 15, 5.5, 16, 7, 18, 13),
    ),
    road(
      'voie-g',
      8,
      GROUP_G,
      c.road,
      widths(8, 1, 10, 1.5, 12, 2.5, 14, 5, 15, 7, 16, 9, 18, 16),
    ),
    // Reserved place: circuits, route and markers come here (later phases).
    zoneBorder,
    label(
      'cote',
      'courbes',
      'contour',
      13,
      eq('major', 1),
      {
        'symbol-placement': 'line',
        'symbol-spacing': 350,
        'text-max-angle': 25,
        'text-field': ['to-string', get('ele')],
        'text-font': ['NotoSans-Regular'],
        'text-size': widths(13, 12, 16, 13),
      },
      { color: c.elevation, halo: 1.5 },
    ),
    label(
      'nom-eau',
      'carte',
      'waterway',
      13,
      oneOf('class', ['river', 'canal']),
      {
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-max-angle': 30,
        'text-field': get('name'),
        'text-font': ['NotoSans-Italic'],
        'text-size': widths(13, 12, 16, 14),
      },
      { color: c.waterText, halo: 1.5 },
    ),
    label(
      'nom-voie',
      'carte',
      'transportation_name',
      15,
      [
        'all',
        LINE,
        [
          '!',
          oneOf('subclass', [
            'footway',
            'pedestrian',
            'steps',
            'corridor',
            'platform',
          ]),
        ],
      ],
      {
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        'text-max-angle': 30,
        'text-field': get('name'),
        'text-font': ['NotoSans-Regular'],
        'text-size': widths(15, 12, 18, 14),
      },
      { color: c.label2, halo: 1.5 },
    ),
    label(
      'lieu-hameau',
      'carte',
      'place',
      13,
      oneOf('class', [
        'hamlet',
        'suburb',
        'quarter',
        'neighbourhood',
        'isolated_dwelling',
      ]),
      {
        'text-field': get('name'),
        'text-font': ['NotoSans-Regular'],
        'text-max-width': 8,
        'text-padding': 4,
        'text-size': widths(13, 12, 16, 14),
      },
      { color: c.label2, halo: 1.5 },
    ),
    label(
      'lieu-village',
      'carte',
      'place',
      11,
      eq('class', 'village'),
      {
        'text-field': get('name'),
        'text-font': ['NotoSans-Bold'],
        'text-max-width': 8,
        'text-padding': 4,
        'text-size': widths(11, 13, 14, 15, 16, 17),
      },
      { color: c.label, halo: 2 },
    ),
    label(
      'lieu-ville',
      'carte',
      'place',
      8,
      oneOf('class', ['city', 'town']),
      {
        'text-field': get('name'),
        'text-font': ['NotoSans-Bold'],
        'text-max-width': 8,
        'text-padding': 4,
        'text-size': widths(
          8,
          ['match', get('class'), 'city', 13, 12],
          12,
          ['match', get('class'), 'city', 17, 15],
          14,
          ['match', get('class'), 'city', 20, 18],
        ),
      },
      { color: c.label, halo: 2 },
    ),
  ];
}

/** The rectangle of the zone as a closed line of four sides. */
export function zoneBorderGeoJson(bbox: Bbox) {
  const { lonMin, latMin, lonMax, latMax } = bbox;
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [lonMin, latMin],
        [lonMax, latMin],
        [lonMax, latMax],
        [lonMin, latMax],
        [lonMin, latMin],
      ],
    },
  } as const;
}

export function buildMapStyle(input: MapStyleInput): StyleSpecification {
  // tokens.md "carte.bord-zone": 2.5 wide, dashes 9 / 6 (in widths).
  const zoneBorder: Layer = {
    id: 'bord-zone',
    type: 'line',
    source: 'bord-zone',
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-color': c.zoneBorder,
      'line-width': 2.5,
      'line-dasharray': [9 / 2.5, 6 / 2.5],
    },
  };
  const style = {
    version: 8,
    sources: {
      carte: { type: 'vector', url: `pmtiles://${input.files.map}` },
      relief: {
        type: 'raster-dem',
        url: `pmtiles://${input.files.terrain}`,
        encoding: 'terrarium',
        tileSize: 512,
      },
      courbes: { type: 'vector', url: `pmtiles://${input.files.contours}` },
      'bord-zone': { type: 'geojson', data: zoneBorderGeoJson(input.bbox) },
    },
    glyphs: `${input.glyphsDir}/{fontstack}/{range}.pbf`,
    layers: layers(zoneBorder),
  };
  return style as unknown as StyleSpecification;
}
