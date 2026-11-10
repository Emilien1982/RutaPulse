import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import { Store } from '@tanstack/react-store';
import type { ReactNode } from 'react';

import { trailsFile } from '@/core/trails/testing';
import type { Zone } from '@/core/zones/catalogue';
import type { DownloadEntry } from '@/core/zones/zoneRow';

import { ZoneMap } from './ZoneMap';

// T9: M4 (chevrons from the zoom 10) and M7 (circuit framed under "Recentrer"). Same fakes as ZoneMapTrailsT4Testeur.
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

describe('M4: chevrons', () => {
  it('the first band of chevrons starts at the zoom 10', async () => {
    await renderMap();
    expect(layerOf('circuit-sens-0').minzoom).toBe(10);
  });
});

describe('M7: framing of the chosen circuit', () => {
  it('keeps the circuit 16 under the Recentrer button: top padding 124', async () => {
    await renderMap();
    await touchTrails([10], [6.005, 48.0]);
    expect(mockEaseTo.mock.calls.at(-1)![0].padding.top).toBe(124);
  });
});
