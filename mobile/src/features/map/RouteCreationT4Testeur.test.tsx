import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// MapLibre, the GPS, the disk and the engine are replaced.
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      return <View testID="map">{props.children}</View>;
    },
    Camera: () => null,
    Layer: () => null,
    UserLocation: () => null,
    GeoJSONSource: (props: { data: unknown }) => {
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

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockComputeRoute.mockResolvedValue(SUCCESS);
});

describe('spec T4 : parcours', () => {
  it('bouton visible avec une zone, absent sans zone', async () => {
    await renderScreen();
    expect(screen.getByTestId('new-route-button')).toBeTruthy();
    await screen.unmount();
    mockInstalled = [];
    await renderScreen();
    expect(screen.queryByTestId('new-route-button')).toBeNull();
  });
});
