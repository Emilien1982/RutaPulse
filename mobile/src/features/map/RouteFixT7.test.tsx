import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// T7 corrections: dotted link (B1), recenter button (B2), camera padding (B3).
const mockSources: { id: string; data: unknown }[] = [];
const mockLayers: {
  id: string;
  beforeId?: string;
  paint?: Record<string, unknown>;
}[] = [];
const mockEaseTo = jest.fn();
const mockComputeRoute = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockSources.length = 0;
      mockLayers.length = 0;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: { current: unknown } }) => {
      if (props.ref) props.ref.current = { easeTo: mockEaseTo };
      return null;
    },
    Layer: (props: {
      id: string;
      beforeId?: string;
      paint?: Record<string, unknown>;
    }) => {
      mockLayers.push(props);
      return null;
    },
    UserLocation: () => null,
    GeoJSONSource: (props: {
      id: string;
      data: unknown;
      children: ReactNode;
    }) => {
      mockSources.push(props);
      return <>{props.children}</>;
    },
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    useCurrentPosition: () => ({
      coords: { longitude: 6.18, latitude: 48.69 },
    }),
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: true, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [nancy] }),
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

const SHAPE: [number, number][] = [
  [6.1, 48.6],
  [6.11, 48.61],
  [6.12, 48.62],
];
const SUCCESS: RouteResult = {
  ok: true,
  shape: SHAPE,
  distanceKm: 3,
  durationS: 600,
};

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <MapScreen />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

// Top of the absolute wrapper around the recenter button.
function recenterTop() {
  let node = screen.getByRole('button', { name: 'Recentrer sur ma position' });
  while (node.parent) {
    const top = StyleSheet.flatten(node.props.style)?.top;
    if (top !== undefined) return top;
    node = node.parent;
  }
  throw new Error('no wrapper with top');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockComputeRoute.mockResolvedValue(SUCCESS);
});

describe('B2 recenter button', () => {
  it('stays at 60 outside the creation', async () => {
    await renderScreen();
    expect(recenterTop()).toBe(60);
  });
});

describe('B3 recenter', () => {
  it('passes a zero padding so an old margin never stays', async () => {
    await renderScreen();
    mockEaseTo.mockClear();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Recentrer sur ma position' }),
    );
    expect(mockEaseTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
    );
  });
});
