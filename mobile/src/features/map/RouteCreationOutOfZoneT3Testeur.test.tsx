import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// ADR 0016 section 5 (T3): out of zone stays outOfZone, checked before the engine.

// MapLibre, the GPS, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: () => null,
    Layer: () => null,
    UserLocation: () => null,
    GeoJSONSource: () => {
      return null;
    },
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    useCurrentPosition: () => undefined,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve({ granted: false }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: (...args: unknown[]) => mockComputeRoute(...args),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const nancy: ReadyMarker = {
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00.000Z',
  zone: {
    id: 'nancy',
    name: 'Nancy',
    version: 3,
    bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 1,
    files: [],
  },
};

const SUCCESS: RouteResult = {
  ok: true,
  shape: [
    [6.1015, 48.6612],
    [6.1408, 48.6846],
  ],
  distanceKm: 25.1,
  durationS: 95 * 60,
};

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <MapScreen />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

// A touch on the map, as MapLibre reports it.
async function touchMap(lon: number, lat: number) {
  const onPress = mockMapProps.onPress as (e: unknown) => void;
  await act(async () => {
    onPress({ nativeEvent: { lngLat: [lon, lat], point: { x: 0, y: 0 } } });
  });
}

const HAYE: [number, number] = [6.1015, 48.6612];

async function startRoute() {
  await fireEvent.press(screen.getByTestId('new-route-button'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockComputeRoute.mockResolvedValue(SUCCESS);
});

describe('out of zone is refused before any engine call (ADR 0016 section 5)', () => {
  it('end outside the rectangle: sheet "Point hors de votre zone", zero engine call', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(2.35, 48.85);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.queryByText('Aucun chemin trouvé')).toBeNull();
  });

  it('start outside the rectangle: same sheet, zero engine call', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(2.35, 48.85);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
  });
});
