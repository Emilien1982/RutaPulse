import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// MapLibre, the GPS, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
let mockLineData: unknown;
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
    GeoJSONSource: (props: { data: unknown }) => {
      mockLineData = props.data;
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
const NANCY: [number, number] = [6.1408, 48.6846];

async function startRoute() {
  await fireEvent.press(screen.getByTestId('new-route-button'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockLineData = undefined;
  mockComputeRoute.mockResolvedValue(SUCCESS);
});

describe('"Nouvel itinéraire" button', () => {
  it('is on the map with a zone', async () => {
    await renderScreen();
    expect(screen.getByTestId('new-route-button')).toBeTruthy();
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    expect(screen.queryByTestId('route-summary')).toBeNull();
  });

  it('does not exist on the map without a zone', async () => {
    mockInstalled = [];
    await renderScreen();
    expect(screen.queryByTestId('new-route-button')).toBeNull();
    expect(screen.queryByText('Nouvel itinéraire')).toBeNull();
  });

  it('opens the creation: top bar, hint, no button', async () => {
    await renderScreen();
    await startRoute();
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    expect(screen.queryByTestId('new-route-button')).toBeNull();
    expect(screen.getByTestId('route-hint')).toBeTruthy();
    expect(screen.getByText('Touchez le départ sur la carte')).toBeTruthy();
  });

  it('closes the creation with the cross', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Fermer sans enregistrer' }),
    );
    expect(screen.getByTestId('new-route-button')).toBeTruthy();
    expect(screen.queryByTestId('route-start')).toBeNull();
  });
});

describe('route creation', () => {
  it('ignores the touches outside the creation', async () => {
    await renderScreen();
    await touchMap(...HAYE);
    expect(screen.queryByTestId('route-start')).toBeNull();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('first touch sets the start and asks for the end', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    expect(screen.getByTestId('route-start')).toBeTruthy();
    expect(screen.getByText("Touchez l'arrivée sur la carte")).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('second touch computes, then shows distance and duration', async () => {
    let finish: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => (finish = resolve)),
    );
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    expect(mockComputeRoute).toHaveBeenCalledWith([
      { lon: HAYE[0], lat: HAYE[1] },
      { lon: NANCY[0], lat: NANCY[1] },
    ]);
    expect(screen.getByTestId('route-computing')).toBeTruthy();
    expect(screen.getByText('Calcul en cours…')).toBeTruthy();
    expect(screen.queryByTestId('route-summary')).toBeNull();

    await act(async () => finish(SUCCESS));
    expect(screen.queryByTestId('route-computing')).toBeNull();
    expect(screen.getByTestId('route-summary')).toBeTruthy();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('25,1 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('1 h 35');
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('Durée estimée')).toBeTruthy();
    expect(screen.getByTestId('route-end')).toBeTruthy();
    expect(mockLineData).toMatchObject({
      geometry: {
        type: 'LineString',
        coordinates: SUCCESS.ok && SUCCESS.shape,
      },
    });
  });

  it('a new touch after the end replaces the end and computes again', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    mockComputeRoute.mockResolvedValue({ ...SUCCESS, distanceKm: 3.2 });
    await touchMap(6.2, 48.7);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(mockComputeRoute).toHaveBeenLastCalledWith([
      { lon: HAYE[0], lat: HAYE[1] },
      { lon: 6.2, lat: 48.7 },
    ]);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('3,2 km');
  });
});

describe('errors', () => {
  it('a point outside the zone: sheet of the mockup 52, engine not called', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(2.35, 48.85);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByText(/aucune zone de RutaPulse/)).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(screen.queryByText(/Télécharger/)).toBeNull();
    expect(screen.queryByText(/à la main/)).toBeNull();
  });

  it('"Retirer ce point" drops the refused touch and keeps the start', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(2.35, 48.85);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.queryByTestId('route-rejected')).toBeNull();
    expect(screen.getByTestId('route-start')).toBeTruthy();
    expect(screen.getByText("Touchez l'arrivée sur la carte")).toBeTruthy();
  });

  it('outOfZone answered by the engine is shown the same way', async () => {
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'outOfZone' });
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(screen.queryByTestId('route-end')).toBeNull();
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.queryByTestId('route-rejected')).toBeNull();
    expect(screen.getByText("Touchez l'arrivée sur la carte")).toBeTruthy();
  });

  it.each([
    ['noRoute', 'Aucun chemin trouvé'],
    ['engineUnavailable', 'Calcul indisponible'],
    ['zoneUnreadable', 'Zone illisible'],
    ['failed', 'Calcul impossible'],
  ] as const)(
    '%s shows a French message and a way out',
    async (kind, title) => {
      mockComputeRoute.mockResolvedValue({ ok: false, error: kind });
      await renderScreen();
      await startRoute();
      await touchMap(...HAYE);
      await touchMap(...NANCY);
      expect(screen.getByTestId('route-error')).toBeTruthy();
      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.queryByTestId('route-summary')).toBeNull();
      await fireEvent.press(screen.getByText('Retirer ce point'));
      expect(screen.queryByTestId('route-error')).toBeNull();
      expect(screen.getByTestId('route-start')).toBeTruthy();
    },
  );
});
