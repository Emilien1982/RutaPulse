import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { trailsFile } from '@/core/trails/testing';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftInSession } from './testing/DraftInSession';

// MapLibre, the router, the disk and the engine are replaced.
let mockMapProps: Record<string, any> = {};
const mockSources: Record<string, any> = {};
const mockReadText = jest.fn();
const mockComputeRoute = jest.fn();
const mockParams: Record<string, string> = {};

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: jest.fn() }));
      return null;
    },
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
    Layer: () => null,
    GeoJSONSource: (props: { id: string }) => {
      mockSources[props.id] = props;
      return null;
    },
    Marker: () => null,
    ViewAnnotation: () => null,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  usePreventRemove: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => {
  const actual = jest.requireActual('@/shared-data/zones/createZoneOps');
  return {
    ...actual,
    createZoneOps: () => ({
      ...actual.createZoneOps(),
      readText: (...a: unknown[]) => mockReadText(...a),
    }),
  };
});
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: (...args: unknown[]) => mockComputeRoute(...args),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: jest.fn(),
  computeTerrain: jest.fn(),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const mockInstalled: ReadyMarker[] = [];
const mockNancy: ReadyMarker = {
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00.000Z',
  zone: {
    id: 'nancy',
    name: 'Nancy',
    version: 6,
    bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 1,
    files: [],
  },
};

const LINE: [number, number][] = [
  [6.0, 48.0],
  [6.01, 48.0],
];

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftInSession />
    </QueryClientProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled.splice(0, mockInstalled.length, mockNancy);
  for (const k of Object.keys(mockSources)) delete mockSources[k];
  mockReadText.mockResolvedValue(
    trailsFile([{ osm_id: 1, name: 'Tour', ordered: null, ways: [LINE] }]),
  );
});

describe('the layer of the circuits in the creation', () => {
  it('draws the same circuits as the map tab', async () => {
    await renderScreen();
    expect(mockReadText).toHaveBeenCalledWith('zones/nancy/v6/trails.geojson');
    expect(
      mockSources.circuits.data.features.map((f: any) => f.properties),
    ).toEqual([{ osm_id: 1, label: 'Tour' }]);
  });

  it('cannot be touched: no press, no hitbox on the source', async () => {
    await renderScreen();
    expect(mockSources.circuits.onPress).toBeUndefined();
    expect(mockSources.circuits.hitbox).toBeUndefined();
  });

  it('leaves the touch on the map to put a point', async () => {
    await renderScreen();
    expect(typeof mockMapProps.onPress).toBe('function');
  });
});
