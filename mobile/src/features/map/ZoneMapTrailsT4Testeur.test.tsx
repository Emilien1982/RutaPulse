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

import { ZoneMap } from './ZoneMap';

// Tester tests, written from the spec (C4, C5, mockup 12 'Règles d'affichage',
// ADR 0020 section 9). MapLibre, the router, the disk and the catalogue are replaced.
let mockMapProps: Record<string, any> = {};
const mockSources: Record<string, any> = {};
const mockLayers: Record<string, any> = {};
const mockReadText = jest.fn();
const mockNavigate = jest.fn();
const mockEaseTo = jest.fn();
let mockZones: Zone[] | undefined = [];

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
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
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
  };
});
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function FakeModal(props: { children: ReactNode }) {
      React.useEffect(() => {}, []);
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

function layerOf(id: string) {
  return mockLayers[id];
}

describe('C4: layers (style-carte.md, Circuits balisés)', () => {
  it('line visible from zoom 10, 6 wide at zoom 15, 55 % blue; name from zoom 12', async () => {
    await renderMap();
    const line = layerOf('circuit');
    expect(line.minzoom).toBe(10);
    expect(line.paint['line-opacity']).toBe(0.55);
    expect(line.paint['line-width']).toEqual(expect.arrayContaining([15, 6]));
    expect(line.layout['line-cap']).toBe('round');
    const name = layerOf('nom-circuit');
    expect(name.minzoom).toBe(12);
    expect(name.layout['symbol-placement']).toBe('line');
    expect(name.layout['text-font']).toEqual(['NotoSans-Bold']);
    expect(name.paint['text-halo-width']).toBe(2);
  });
  it('the line goes under "cote" (above the roads), the name under places, over road names', async () => {
    await renderMap();
    const before = layerOf('circuit').beforeId;
    const nameBefore = layerOf('nom-circuit').beforeId;
    expect(before).toBe('cote');
    expect(nameBefore).toBe('lieu-hameau');
  });
  it('the chosen layers are declared after the faded ones (so above them)', async () => {
    await renderMap();
    const order = Object.keys(mockLayers);
    expect(order.indexOf('circuit-choisi')).toBeGreaterThan(
      order.indexOf('circuit'),
    );
    expect(order.indexOf('circuit-choisi-lisere')).toBeLessThan(
      order.indexOf('circuit-choisi'),
    );
  });
});

describe("mise en avant (mockup 12, Règles d'affichage)", () => {
  it('chosen: solid 8, white edge 12, others fade, 5 chevrons in band 3 (every 150 m), none after close', async () => {
    await renderMap();
    const normal = layerOf('circuit').paint['line-opacity'];
    await touchTrails([10], [6.005, 48.0]);
    expect(layerOf('circuit-choisi').paint['line-width']).toBe(8);
    expect(layerOf('circuit-choisi-lisere').paint['line-width']).toBe(12);
    expect(layerOf('circuit-choisi-lisere').paint['line-color']).toBe(
      '#FFFFFF',
    );
    expect(layerOf('circuit').paint['line-opacity']).toBeLessThan(normal);
    // The chevrons are points with a bearing (band 3: every 150 m), not a text along the line.
    expect(layerOf('circuit-sens-3').layout['symbol-placement']).toBe('point');
    expect(layerOf('circuit-sens-3').layout['text-field']).toBe('>');
    expect(mockSources['circuit-choisi'].data.features).toHaveLength(1);
    // Circuit 10 runs east for about 744 m: band 3 (every 150 m, first at 75 m)
    // gives the points at 75, 225, 375, 525 and 675 m, all pointing east.
    const band3 = () =>
      mockSources['circuit-sens-points'].data.features.filter(
        (f: any) => f.properties.band === 3,
      );
    expect(band3()).toHaveLength(5);
    for (const f of band3()) expect(f.properties.rotate).toBeCloseTo(0, 0);
    await fireEvent.press(screen.getByTestId('trail-close'));
    expect(layerOf('circuit').paint['line-opacity']).toBe(normal);
    expect(mockSources['circuit-choisi'].data.features).toHaveLength(0);
    expect(band3()).toHaveLength(0);
  });
  it('a circuit without ordered line (old zone) gets no chevron at all', async () => {
    await renderMap();
    await touchTrails([30], [6.005, 48.0]);
    expect(mockSources['circuit-sens-points'].data.features).toHaveLength(0);
  });
  it('the camera frames the circuit above the sheet (bottom padding) then goes back', async () => {
    await renderMap();
    await act(async () => {
      mockMapProps.onRegionDidChange?.({
        nativeEvent: { center: [6.1, 48.1], zoom: 12, userInteraction: true },
      });
    });
    await touchTrails([10], [6.005, 48.0]);
    const framed = mockEaseTo.mock.calls.at(-1)![0];
    expect(framed.padding.bottom).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('trail-close'));
    expect(mockEaseTo.mock.calls.at(-1)![0].padding.bottom).toBe(0);
  });
});

describe('touch behaviour (ADR 0020 section 9)', () => {
  it('a touch on the map outside a circuit closes the sheet', async () => {
    await renderMap();
    await touchTrails([10], [6.005, 48.0]);
    expect(screen.getByTestId('trail-close')).toBeTruthy();
    await act(async () => {
      mockMapProps.onPress?.({ nativeEvent: { lngLat: [6, 48] } });
    });
    expect(screen.queryByTestId('trail-close')).toBeNull();
  });
  it('stops the propagation of a touch on a circuit', async () => {
    await renderMap();
    const stop = await touchTrails([10], [6.005, 48.0]);
    expect(stop).toHaveBeenCalled();
  });
  it('two circuits: list "2 circuits passent ici", then the sheet of the chosen one', async () => {
    await renderMap();
    await touchTrails([10, 20], [6.005, 48.0]);
    expect(screen.getByText('2 circuits passent ici')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('trail-row-20'));
    expect(screen.getByText('Les Trois Vallées')).toBeTruthy();
    expect(screen.getByTestId('trail-make')).toBeTruthy();
  });
  it('a refused or old circuit in the list leads to a sheet without the itinerary button', async () => {
    await renderMap();
    await touchTrails([10, 30], [6.005, 48.0]);
    await fireEvent.press(screen.getByTestId('trail-row-30'));
    expect(screen.queryByTestId('trail-make')).toBeNull();
    expect(screen.getByText('Circuit 7')).toBeTruthy();
  });
});

describe('maquette E: the update ends while the sheet is open', () => {
  it('closes the sheet (MapScreen keys ZoneMap by zone and version), because the circuit has new data', async () => {
    mockZones = [zone(6)];
    mockReadText.mockResolvedValue(
      trailsFile([{ osm_id: 30, ref: '7', length_m: 12000, ways: [A] }]),
    );
    const client = new QueryClient();
    const ui = (z: Zone) => (
      <QueryClientProvider client={client}>
        <ZoneMap key={`${z.id}-${z.version}`} zone={z} downloadStore={store} />
      </QueryClientProvider>
    );
    const view = await render(ui(zone(5)));
    await waitFor(() => expect(mockReadText).toHaveBeenCalled());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await touchTrails([30], [6.005, 48.0]);
    expect(screen.getByText('Zone à mettre à jour.')).toBeTruthy();
    await act(async () => {
      view.rerender(ui(zone(6)));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.queryByText('Zone à mettre à jour.')).toBeNull();
    expect(screen.queryByTestId('trail-close')).toBeNull();
  });
});
