import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// T7 corrections: dotted link (B1), recenter button (B2), camera padding (B3).
let mockMapProps: Record<string, unknown> = {};
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
      mockMapProps = props;
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

async function touchMap(lon: number, lat: number) {
  const onPress = mockMapProps.onPress as (e: unknown) => void;
  await act(async () => {
    onPress({ nativeEvent: { lngLat: [lon, lat], point: { x: 0, y: 0 } } });
  });
}

async function startRoute() {
  await fireEvent.press(screen.getByTestId('new-route-button'));
}

function linkData() {
  const source = mockSources.find((s) => s.id === 'route-link');
  const data = source?.data as
    { features: { geometry: { coordinates: number[][] } }[] } | undefined;
  return data && data.features.length > 0 ? data : undefined;
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

describe('B1 dotted link', () => {
  it('draws start -> first point and last point -> end, under the route', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(6.1, 48.601);
    await touchMap(6.12, 48.621);
    expect(linkData()?.features.map((f) => f.geometry.coordinates)).toEqual([
      [
        [6.1, 48.601],
        [6.1, 48.6],
      ],
      [
        [6.12, 48.62],
        [6.12, 48.621],
      ],
    ]);
    const ids = mockSources.map((s) => s.id);
    expect(ids.indexOf('route-link')).toBeLessThan(ids.indexOf('route'));
    const layerIds = mockLayers.map((l) => l.id);
    expect(layerIds.indexOf('route-link-line')).toBeLessThan(
      layerIds.indexOf('route-casing'),
    );
    const paint = mockLayers.find((l) => l.id === 'route-link-line')?.paint;
    expect(paint?.['line-color']).toBe('#C2007A');
    expect(paint?.['line-dasharray']).toEqual([0.1, 2.5]);
    expect(paint?.['line-width']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      12,
      3 * 0.6,
      15,
      3,
      17,
      3 * 1.3,
    ]);
  });

  it('draws no link when the points are on the route (< 5 m)', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(6.1, 48.6);
    await touchMap(6.12, 48.62);
    expect(linkData()).toBeUndefined();
  });

  it('draws no link while computing', async () => {
    mockComputeRoute.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await startRoute();
    await touchMap(6.1, 48.601);
    await touchMap(6.12, 48.621);
    expect(linkData()).toBeUndefined();
  });

  it('draws no link with an error sheet', async () => {
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'noRoute' });
    await renderScreen();
    await startRoute();
    await touchMap(6.1, 48.601);
    await touchMap(6.12, 48.621);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(linkData()).toBeUndefined();
  });
});

describe('B1 layer order', () => {
  it('renders the route source and its casing from the opening', async () => {
    await renderScreen();
    await startRoute();
    expect(mockSources.map((s) => s.id)).toEqual(['route-link', 'route']);
    const ids = mockLayers.map((l) => l.id);
    expect(ids).toEqual(['route-link-line', 'route-casing', 'route-line']);
  });

  it('puts the link layer under the casing with beforeId', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(6.1, 48.601);
    await touchMap(6.12, 48.621);
    expect(mockLayers.find((l) => l.id === 'route-link-line')?.beforeId).toBe(
      'route-casing',
    );
  });

  it('keeps the link source mounted when the link goes and comes back', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(6.1, 48.601);
    await touchMap(6.12, 48.621);
    await touchMap(0, 0); // refused point: the link goes, the route stays
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(linkData()).toBeUndefined();
    expect(mockSources.some((s) => s.id === 'route-link')).toBe(true);
    expect(mockSources.some((s) => s.id === 'route')).toBe(true);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(linkData()).toBeDefined();
    expect(mockLayers.find((l) => l.id === 'route-link-line')?.beforeId).toBe(
      'route-casing',
    );
  });
});

describe('B2 recenter button', () => {
  it('stays at 60 outside the creation', async () => {
    await renderScreen();
    expect(recenterTop()).toBe(60);
  });

  it('goes to bar height + 64 in creation', async () => {
    await renderScreen();
    await startRoute();
    await fireEvent(screen.getByText('Nouvel itinéraire'), 'layout', {
      nativeEvent: { layout: { height: 112 } },
    });
    expect(recenterTop()).toBe(176);
  });
});

describe('B3 refused point', () => {
  it('centers it in the visible part: bar on top, sheet at the bottom', async () => {
    await renderScreen();
    await startRoute();
    await fireEvent(screen.getByText('Nouvel itinéraire'), 'layout', {
      nativeEvent: { layout: { height: 112 } },
    });
    await touchMap(0, 0); // outside the zone
    expect(screen.getByTestId('route-error')).toBeTruthy();
    await fireEvent(screen.getByTestId('route-error'), 'layout', {
      nativeEvent: { layout: { height: 310 } },
    });
    expect(mockEaseTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        center: [0, 0],
        padding: { top: 112, bottom: 310, left: 0, right: 0 },
      }),
    );
  });
});

describe('B3 camera after the error', () => {
  it('does not move the camera when the error goes away', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(0, 0);
    mockEaseTo.mockClear();
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(mockEaseTo).not.toHaveBeenCalled();
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
