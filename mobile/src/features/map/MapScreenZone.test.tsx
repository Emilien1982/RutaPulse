import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// MapLibre, the GPS and the disk are replaced: no native module in Jest.
const mockEaseTo = jest.fn();
const mockNavigate = jest.fn();
let mockMapProps: Record<string, unknown> = {};
let mockCameraProps: Record<string, unknown> = {};
let mockPosition:
  { coords: { longitude: number; latitude: number } } | undefined;
let mockInstalled: ReadyMarker[] | undefined;
let mockPermission = { granted: true };

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View, Text } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: Record<string, unknown> & { ref?: unknown }) => {
      mockCameraProps = props;
      const ref = props.ref as { current: unknown } | undefined;
      if (ref) ref.current = { easeTo: mockEaseTo };
      return null;
    },
    Layer: () => null,
    UserLocation: () => <Text>blue dot</Text>,
    useCurrentPosition: () => mockPosition,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve(mockPermission),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
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

async function renderScreen() {
  const queryClient = new QueryClient();
  await render(
    <QueryClientProvider client={queryClient}>
      <MapScreen />
    </QueryClientProvider>,
  );
  // Lets the permission request finish.
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockPosition = undefined;
  mockPermission = { granted: true };
});

describe('MapScreen without a ready zone', () => {
  beforeEach(() => {
    mockInstalled = [];
  });

  it('shows the empty state of the mockup 91', async () => {
    await renderScreen();
    expect(screen.getByText('Pas encore de carte')).toBeTruthy();
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.queryByText(/OpenStreetMap/)).toBeNull();
  });

  it('opens the Zones tab with the button', async () => {
    await renderScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Choisir une zone' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
  });
});

describe('MapScreen with a ready zone', () => {
  it('shows the map with the style of the zone, no network', async () => {
    await renderScreen();
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(JSON.stringify(mockMapProps.mapStyle)).toContain(
      'pmtiles://file:///doc/zones/nancy/map.pmtiles',
    );
    expect(JSON.stringify(mockMapProps.mapStyle)).not.toMatch(/https?:/);
  });

  it('shows the whole zone, zooms 8 to 18, no rotation nor tilt', async () => {
    await renderScreen();
    expect(mockCameraProps.minZoom).toBe(8);
    expect(mockCameraProps.maxZoom).toBe(18);
    expect(
      (mockCameraProps.initialViewState as { bounds: number[] }).bounds,
    ).toEqual([5.84, 48.47, 6.52, 48.92]);
    // The center of the camera cannot leave the zone.
    expect(mockCameraProps.maxBounds).toEqual([5.84, 48.47, 6.52, 48.92]);
    expect(mockMapProps.touchRotate).toBe(false);
    expect(mockMapProps.touchPitch).toBe(false);
    expect(mockMapProps.attribution).toBe(false);
    expect(mockMapProps.logo).toBe(false);
  });

  it('always shows the four attributions', async () => {
    await renderScreen();
    expect(
      screen.getByText('© OpenStreetMap © OpenMapTiles © Mapterhorn © IGN'),
    ).toBeTruthy();
  });

  it('shows the blue dot only with the permission', async () => {
    await renderScreen();
    expect(screen.getByText('blue dot')).toBeTruthy();
  });

  it('shows no blue dot when the permission is refused', async () => {
    mockPermission = { granted: false };
    await renderScreen();
    expect(screen.queryByText('blue dot')).toBeNull();
  });
});

describe('recenter button', () => {
  const recenter = () =>
    screen.getByRole('button', { name: 'Recentrer sur ma position' });

  it('centers the map on the position, with no message inside the zone', async () => {
    mockPosition = { coords: { longitude: 6.1844, latitude: 48.6921 } };
    await renderScreen();
    await fireEvent.press(recenter());
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1844, 48.6921], zoom: 15 }),
    );
    expect(
      screen.queryByText('Vous êtes hors de la zone téléchargée'),
    ).toBeNull();
  });

  it('goes to the closest point of the zone and says so when outside', async () => {
    // Metz, north of the zone of Nancy.
    mockPosition = { coords: { longitude: 6.1757, latitude: 49.1193 } };
    await renderScreen();
    await fireEvent.press(recenter());
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1757, 48.92] }),
    );
    expect(
      screen.getByText('Vous êtes hors de la zone téléchargée'),
    ).toBeTruthy();
  });

  it('removes the message after a few seconds', async () => {
    jest.useFakeTimers();
    try {
      mockPosition = { coords: { longitude: 2.35, latitude: 48.85 } };
      await renderScreen();
      await fireEvent.press(recenter());
      expect(
        screen.getByText('Vous êtes hors de la zone téléchargée'),
      ).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });
      expect(
        screen.queryByText('Vous êtes hors de la zone téléchargée'),
      ).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does nothing without a known position', async () => {
    await renderScreen();
    await fireEvent.press(recenter());
    expect(mockEaseTo).not.toHaveBeenCalled();
  });
});
