import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Store } from '@tanstack/react-store';
import type { ReactNode } from 'react';

import { trailsFile } from '@/core/trails/testing';
import type { Zone } from '@/core/zones/catalogue';
import type { DownloadEntry } from '@/core/zones/zoneRow';

import { buildMapStyle } from './mapStyle';
import { TRAILS_LINE_BEFORE, TRAILS_NAME_BEFORE } from './TrailsLayer';
import { ZoneMap } from './ZoneMap';

// MapLibre, the router, the disk and the catalogue are replaced.
let mockMapProps: Record<string, any> = {};
const mockSources: Record<string, any> = {};
const mockLayers: Record<string, any> = {};
const mockReadText = jest.fn();
const mockNavigate = jest.fn();
const mockEaseTo = jest.fn();
let mockMapRenders = 0;
let mockModalMounts = 0;
let mockZones: Zone[] | undefined = [];

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      mockMapRenders += 1;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: mockEaseTo }));
      return null;
    },
    Layer: (props: { id: string }) => {
      mockLayers[props.id] = props;
      return null;
    },
    GeoJSONSource: (props: { id: string; children: ReactNode }) => {
      mockSources[props.id] = props;
      return <>{props.children}</>;
    },
  };
});
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function FakeModal(props: { children: ReactNode }) {
      React.useEffect(() => {
        mockModalMounts += 1;
      }, []);
      return <View>{props.children}</View>;
    },
  };
});
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ readText: (...a: unknown[]) => mockReadText(...a) }),
}));
jest.mock('@/shared-data/zones/useCatalogue', () => ({
  useCatalogue: () => ({
    data: mockZones && { zones: mockZones },
    isError: mockZones === undefined,
    fetchStatus: 'idle',
  }),
}));
jest.mock('./MapPosition', () => ({
  NO_PADDING: { top: 0, right: 0, bottom: 0, left: 0 },
  RECENTER_ZOOM: 14,
  RecenterButton: () => null,
  UserPositionLayers: () => null,
  useMapPosition: () => ({
    granted: false,
    lon: undefined,
    lat: undefined,
    recenter: () => {},
  }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: mockNavigate }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

function zone(version: number): Zone {
  return {
    id: 'nancy',
    name: 'Nancy',
    version,
    bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 108_000_000,
    files: [],
  };
}

const A: [number, number][] = [
  [6.0, 48.0],
  [6.01, 48.0],
];
const B: [number, number][] = [
  [6.0, 48.001],
  [6.01, 48.001],
];

const FILE = trailsFile([
  {
    osm_id: 20,
    name: 'Les Trois Vallées',
    ordered: B,
    loop: false,
    ordered_m: 18600,
    removed_m: 0,
    ways: [B],
  },
  {
    osm_id: 10,
    name: 'Petite Suisse Lorraine à VTT',
    ordered: A,
    loop: true,
    ordered_m: 34904,
    removed_m: 0,
    ways: [A],
  },
  { osm_id: 30, ref: '7', length_m: 12000, ways: [A] }, // no `ordered`: old zone
]);

const store = new Store<Record<string, DownloadEntry>>({});

async function renderMap(
  onUpdateZone?: (zone: Zone) => void,
  mapZone: Zone = zone(6),
) {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <ZoneMap
        zone={mapZone}
        onUpdateZone={onUpdateZone}
        downloadStore={store}
      />
    </QueryClientProvider>,
  );
  // The file is read once, then the layer gets its data.
  await waitFor(() =>
    expect(mockReadText.mock.calls.length).toBeGreaterThan(0),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function feature(osmId: number) {
  return { type: 'Feature', properties: { osm_id: osmId }, geometry: null };
}

// A touch on the circuits, as MapLibre reports it.
async function touchTrails(ids: number[], lngLat: [number, number]) {
  const stopPropagation = jest.fn();
  await act(async () => {
    mockSources.circuits.onPress({
      stopPropagation,
      nativeEvent: {
        lngLat,
        point: { x: 0, y: 0 },
        features: ids.map(feature),
      },
    });
  });
  return stopPropagation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReadText.mockResolvedValue(FILE);
  mockZones = [];
  store.setState(() => ({}));
  for (const k of Object.keys(mockSources)) delete mockSources[k];
});

describe('the layer of the circuits on the map tab', () => {
  it('reads trails.geojson of the zone version and draws the light copy', async () => {
    await renderMap();
    expect(mockReadText).toHaveBeenCalledWith('zones/nancy/v6/trails.geojson');
    const data = mockSources.circuits.data;
    expect(data.features.map((f: any) => f.properties)).toEqual([
      { osm_id: 20, label: 'Les Trois Vallées' },
      { osm_id: 10, label: 'Petite Suisse Lorraine à VTT' },
      { osm_id: 30, label: 'Circuit 7' },
    ]);
    expect(JSON.stringify(data)).not.toContain('ordered');
  });

  it('draws the line above the roads and the name under the names of places', async () => {
    await renderMap();
    expect(mockLayers.circuit.beforeId).toBe(TRAILS_LINE_BEFORE);
    expect(mockLayers['nom-circuit'].beforeId).toBe(TRAILS_NAME_BEFORE);
    const ids = buildMapStyle({
      files: { map: 'a', terrain: 'b', contours: 'c' },
      glyphsDir: 'g',
      bbox: zone(6).bbox,
    }).layers.map((layer) => layer.id);
    expect(ids).toContain(TRAILS_LINE_BEFORE);
    expect(ids).toContain(TRAILS_NAME_BEFORE);
    expect(ids.indexOf('voie-g')).toBeLessThan(ids.indexOf(TRAILS_LINE_BEFORE));
    expect(ids.indexOf('nom-voie')).toBeLessThan(
      ids.indexOf(TRAILS_NAME_BEFORE),
    );
  });

  it('gives the source a press with a hitbox of 44 x 44, never 0', async () => {
    await renderMap();
    expect(typeof mockSources.circuits.onPress).toBe('function');
    expect(mockSources.circuits.hitbox).toEqual({
      top: 22,
      right: 22,
      bottom: 22,
      left: 22,
    });
  });

  it('gives an empty layer when the file cannot be read', async () => {
    mockReadText.mockRejectedValue(new Error('missing'));
    await renderMap();
    expect(mockSources.circuits.data.features).toEqual([]);
  });
});

describe('a touch on circuits', () => {
  it('opens the sheet of the only circuit, and does not touch the map', async () => {
    await renderMap();
    const stop = await touchTrails([10], [6.005, 48.0]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Petite Suisse Lorraine à VTT')).toBeTruthy();
    expect(screen.getByText('34,9 km · boucle')).toBeTruthy();
    expect(screen.getByTestId('trail-make')).toBeTruthy();
  });

  it('lists several circuits, the nearest first, then opens the chosen one', async () => {
    await renderMap();
    await touchTrails([10, 20, 10], [6.005, 48.0009]);
    expect(screen.getByText('2 circuits passent ici')).toBeTruthy();
    const rows = screen.getAllByTestId(/^trail-row-/);
    expect(rows.map((r) => r.props.testID)).toEqual([
      'trail-row-20',
      'trail-row-10',
    ]);
    await fireEvent.press(screen.getByTestId('trail-row-10'));
    expect(screen.queryByText('2 circuits passent ici')).toBeNull();
    expect(screen.getByText('34,9 km · boucle')).toBeTruthy();
  });

  it('orders the list by osm_id when the circuits share the path', async () => {
    mockReadText.mockResolvedValue(
      trailsFile([
        { osm_id: 20, ordered: null, ways: [A] },
        { osm_id: 10, ordered: null, ways: [A] },
      ]),
    );
    await renderMap();
    await touchTrails([20, 10], [6.005, 48.0]);
    expect(
      screen.getAllByTestId(/^trail-row-/).map((r) => r.props.testID),
    ).toEqual(['trail-row-10', 'trail-row-20']);
  });

  it('closes the sheet by the cross, the backdrop and a touch on the map', async () => {
    await renderMap();
    await touchTrails([10], [6.005, 48.0]);
    await fireEvent.press(screen.getByTestId('trail-close'));
    expect(screen.queryByTestId('trail-make')).toBeNull();

    await touchTrails([10], [6.005, 48.0]);
    await fireEvent.press(
      screen.getByTestId('trail-backdrop', { includeHiddenElements: true }),
    );
    expect(screen.queryByTestId('trail-make')).toBeNull();

    await touchTrails([10], [6.005, 48.0]);
    await act(async () => mockMapProps.onPress({ nativeEvent: {} }));
    expect(screen.queryByTestId('trail-make')).toBeNull();
  });

  it('closes the sheet when "En faire un itinéraire" is pressed (T5 completes it)', async () => {
    await renderMap();
    await touchTrails([10], [6.005, 48.0]);
    await fireEvent.press(screen.getByTestId('trail-make'));
    expect(screen.queryByTestId('trail-make')).toBeNull();
  });

  it('ignores a touch that finds no known circuit', async () => {
    await renderMap();
    await touchTrails([999], [6.005, 48.0]);
    expect(screen.queryByTestId('trail-close')).toBeNull();
  });
});

describe('an old zone', () => {
  it('shows the circuits and offers the update, which starts then opens the Zones tab', async () => {
    mockZones = [zone(7)];
    const onUpdateZone = jest.fn();
    await renderMap(onUpdateZone, zone(5));
    await touchTrails([30], [6.005, 48.0]);
    expect(screen.getByText('Circuit 7')).toBeTruthy();
    expect(screen.getByText(/Zone à mettre à jour\./)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('trail-update'));
    expect(onUpdateZone).toHaveBeenCalledWith(zone(7));
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
    expect(screen.queryByTestId('trail-update')).toBeNull();
  });

  it('"Voir les zones" opens the Zones tab when the catalogue is unknown', async () => {
    mockZones = undefined;
    await renderMap(undefined, zone(5));
    await touchTrails([30], [6.005, 48.0]);
    await fireEvent.press(screen.getByTestId('trail-see-zones'));
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
  });
});

// A Modal that mounts twice (the list, then the sheet) is refused by iOS
// during the closing animation of the first. Here: one mount.
describe('one Modal for the list and the sheet', () => {
  it('keeps a single Modal from the list to the sheet of the chosen circuit', async () => {
    await renderMap();
    mockModalMounts = 0;
    await touchTrails([10, 20], [6.005, 48.0009]);
    expect(mockModalMounts).toBe(1);
    await fireEvent.press(screen.getByTestId('trail-row-10'));
    expect(screen.getByTestId('trail-make')).toBeTruthy();
    expect(mockModalMounts).toBe(1);
  });
});

describe('the chosen circuit', () => {
  it('draws the chosen circuit on its ordered line and fades the others', async () => {
    await renderMap();
    expect(mockLayers.circuit.paint['line-opacity']).toBe(0.55);
    expect(mockSources['circuit-choisi'].data.features).toEqual([]);
    await touchTrails([10], [6.005, 48.0]);
    expect(mockLayers.circuit.paint['line-opacity']).toBe(0.25);
    const [chosen] = mockSources['circuit-choisi'].data.features;
    expect(chosen.properties.osm_id).toBe(10);
    expect(chosen.geometry).toEqual({ type: 'LineString', coordinates: A });
    expect(mockLayers['circuit-choisi'].paint['line-width']).toBe(8);
    expect(mockLayers['circuit-choisi-lisere'].paint['line-width']).toBe(12);
    const arrows = mockSources['circuit-sens-points'].data.features;
    expect(arrows.length).toBeGreaterThan(0);
    // The line runs east: the arrows point east.
    expect(arrows.every((f: any) => f.properties.rotate === 0)).toBe(true);
    expect(mockLayers['circuit-sens-0'].layout['symbol-placement']).toBe(
      'point',
    );
  });

  it('draws the raw ways, without arrows, when the order is unknown', async () => {
    await renderMap();
    await touchTrails([30], [6.005, 48.0]);
    const [chosen] = mockSources['circuit-choisi'].data.features;
    expect(chosen.geometry.type).toBe('MultiLineString');
    // No known direction, no arrow.
    expect(mockSources['circuit-sens-points'].data.features).toEqual([]);
  });

  it('frames the circuit above the sheet, then goes back to the view', async () => {
    await renderMap();
    await act(async () =>
      mockMapProps.onRegionDidChange({
        nativeEvent: { center: [6.2, 48.7], zoom: 11.5 },
      }),
    );
    mockEaseTo.mockClear();
    await touchTrails([10], [6.005, 48.0]);
    const framing = mockEaseTo.mock.calls.at(-1)![0];
    expect(framing.padding.bottom).toBeGreaterThan(300);
    expect(framing.center[0]).toBeCloseTo(6.005, 3);
    await fireEvent.press(screen.getByTestId('trail-close'));
    expect(mockEaseTo.mock.calls.at(-1)![0]).toMatchObject({
      center: [6.2, 48.7],
      zoom: 11.5,
    });
  });
});

describe('redraws', () => {
  it('keeps the same press handler when a sheet opens', async () => {
    await renderMap();
    const before = mockSources.circuits.onPress;
    await touchTrails([10], [6.005, 48.0]);
    expect(mockSources.circuits.onPress).toBe(before);
  });

  it('does not redraw the map at each step of a download', async () => {
    await renderMap(undefined, zone(5));
    const entry = (doneBytes: number): DownloadEntry => ({
      zone: zone(6),
      state: { kind: 'downloading', doneBytes, totalBytes: 100 },
    });
    await act(async () => store.setState(() => ({ nancy: entry(1) })));
    const renders = mockMapRenders;
    await act(async () => store.setState(() => ({ nancy: entry(50) })));
    await act(async () => store.setState(() => ({ nancy: entry(99) })));
    expect(mockMapRenders).toBe(renders);
  });

  it('tells the sheet that the update is running, or has failed', async () => {
    await renderMap(undefined, zone(5));
    await touchTrails([30], [6.005, 48.0]);
    await act(async () =>
      store.setState(() => ({
        nancy: { zone: zone(6), state: { kind: 'queued' } },
      })),
    );
    expect(screen.getByText(/Mise à jour en cours\./)).toBeTruthy();
    await act(async () =>
      store.setState(() => ({
        nancy: {
          zone: zone(6),
          state: { kind: 'no-space', neededBytes: 9, availableBytes: 1 },
        },
      })),
    );
    expect(screen.getByText(/La mise à jour n'a pas abouti\./)).toBeTruthy();
  });
});
