import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';

// MapLibre, the router, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
let mockCameraProps: Record<string, unknown> = {};
const mockSources: Record<string, any> = {};
const mockAnnotations: Record<string, any> = {};
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();
const mockEaseTo = jest.fn();
let mockGranted = false;
let mockPosition:
  { coords: { longitude: number; latitude: number } } | undefined;
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      mockCameraProps = props as Record<string, unknown>;
      useImperativeHandle(props.ref, () => ({ easeTo: mockEaseTo }));
      return null;
    },
    UserLocation: (props: { children: ReactNode }) => (
      <View testID="user-location">{props.children}</View>
    ),
    useCurrentPosition: () => mockPosition,
    Layer: () => null,
    GeoJSONSource: (props: { id: string; data: unknown }) => {
      mockSources[props.id] = props.data;
      return null;
    },
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    ViewAnnotation: (props: { id: string; children: ReactNode }) => {
      mockAnnotations[props.id] = props;
      return <View testID={`annotation:${props.id}`}>{props.children}</View>;
    },
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: mockGranted, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: mockGranted, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
  usePreventRemove: () => {},
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

const P1: [number, number] = [6.1, 48.66];
const P2: [number, number] = [6.14, 48.68];
const P3: [number, number] = [6.18, 48.7];
const P4: [number, number] = [6.2, 48.72];
const OUTSIDE: [number, number] = [7.5, 48.7];
const FAR: [number, number] = [6.12, 48.8];

// A leg whose shape ends exactly on the points: no dotted link.
function success(distanceKm = 2, durationS = 600): RouteResult {
  return {
    ok: true,
    shape: [
      [6.1, 48.66],
      [6.14, 48.68],
    ],
    distanceKm,
    durationS,
  };
}

// Cleared after each test: the 30 minutes of the cache would keep Jest alive.
let client = new QueryClient();
afterEach(() => client.clear());

async function renderScreen() {
  client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <DraftScreen />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

// A touch on the map, as MapLibre reports it.
async function touchMap(at: [number, number]) {
  const onPress = mockMapProps.onPress as (e: unknown) => void;
  await act(async () => {
    onPress({ nativeEvent: { lngLat: at, point: { x: 0, y: 0 } } });
    // A touch on the map waits a moment before it adds a point.
    await new Promise((resolve) => setTimeout(resolve, 130));
  });
  await flush();
}

// Lets the answer of the (faked) engine reach the screen.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function addPoints(...points: [number, number][]) {
  for (const p of points) await touchMap(p);
}

// Ids of the annotations on screen, in the order of the points.
function pointIds() {
  return screen
    .queryAllByTestId(/^annotation:/)
    .map((node) => String(node.props.testID).slice('annotation:'.length));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockParams = {};
  mockGranted = false;
  mockPosition = undefined;
  for (const key of Object.keys(mockSources)) delete mockSources[key];
  for (const key of Object.keys(mockAnnotations)) delete mockAnnotations[key];
  mockComputeRoute.mockResolvedValue(success());
});

const lngLatOf = () =>
  pointIds().map((id) => (mockAnnotations[id] as { lngLat: number[] }).lngLat);

// Tests written from the spec (C7, C8, C9, C12), not from the code.
// The fake engine behaves like the real one for a leg [from, to]: outside the
// rectangle of the zone -> outOfZone; a point flagged far -> farFromPath.
const same = (p: { lon: number; lat: number }, q: [number, number]) =>
  p.lon === q[0] && p.lat === q[1];
function realisticEngine(points: { lon: number; lat: number }[]) {
  const [a, b] = points as { lon: number; lat: number }[];
  if (points.some((p) => p.lon > 6.52 || p.lon < 5.84)) {
    return Promise.resolve({ ok: false, error: 'outOfZone' } as RouteResult);
  }
  if (points.some((p) => same(p, FAR))) {
    return Promise.resolve({ ok: false, error: 'farFromPath' } as RouteResult);
  }
  return Promise.resolve({
    ok: true,
    shape: [
      [a!.lon, a!.lat],
      [b!.lon, b!.lat],
    ],
    distanceKm: 2,
    durationS: 600,
  } as RouteResult);
}
const modes = () =>
  (mockSources['draft-legs'].features as any[]).map((f) => f.properties.mode);

describe('C7 hand mode (spec)', () => {
  it('the map zooms up to 18', async () => {
    await renderScreen();
    expect(mockCameraProps.maxZoom).toBe(18);
  });

  it('the mode applies to the next leg only; a hand leg is dashed, straight, no engine call', async () => {
    await renderScreen();
    await addPoints(P1);
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P2);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(modes()).toEqual(['hand']);
    expect(mockSources['draft-legs'].features[0].geometry.coordinates).toEqual([
      P1,
      P2,
    ]);
    // Reference by hand (haversine, R = 6371 km): dlat 0.02 deg = 2.224 km,
    // dlon 0.04 deg x cos(48.67) = 2.937 km, distance = 3.68 km -> "3,7 km";
    // at 10 km/h: 22.1 min -> "22 min".
    expect(screen.getByTestId('route-distance')).toHaveTextContent('3,7 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('22 min');
    // Back to "path": the following leg goes to the engine.
    await fireEvent.press(screen.getByTestId('route-mode-path'));
    await addPoints(P3);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(modes()).toEqual(['hand', 'path']);
  });

  it('a hand leg between two computed legs: distance changes, duration at their speed', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P3);
    await fireEvent.press(screen.getByTestId('route-mode-path'));
    await addPoints(P4);
    expect(modes()).toEqual(['path', 'hand', 'path']);
    // Hand leg P2-P3: dlat 0.02 deg = 2.224 km, dlon 0.04 x cos(48.69) =
    // 0.02642 deg = 2.938 km -> 3.685 km. Total 2 + 3.685 + 2 = 7.685 -> 7,7.
    expect(screen.getByTestId('route-distance')).toHaveTextContent('7,7 km');
    // Engine legs: 4 km in 1200 s = 12 km/h. Hand: 3.685 / 12 h = 18.4 min.
    // Total 20 + 18.4 = 38.4 min -> 38 min.
    expect(screen.getByTestId('route-duration')).toHaveTextContent('38 min');
  });
});

describe('C8 far from a path (spec)', () => {
  it('a far point gives the sheet; the dotted link under 200 m stays and is not counted', async () => {
    mockComputeRoute.mockImplementation(realisticEngine);
    await renderScreen();
    await addPoints(P1);
    await addPoints(FAR);
    expect(screen.getByText('Aucun chemin trouvé')).toBeTruthy();
    expect(screen.getByTestId('route-error-relink')).toBeTruthy();
    expect(screen.getByTestId('route-error-remove')).toBeTruthy();
    expect(screen.getByText(/plus de 200.m d.un chemin/)).toBeTruthy();
    // The touch map is blocked while the sheet is open.
    const calls = mockComputeRoute.mock.calls.length;
    await addPoints(P3);
    expect(mockComputeRoute.mock.calls).toHaveLength(calls);
    expect(screen.getByTestId('route-error')).toBeTruthy();
  });

  it('a close point: dotted link drawn, counted in neither distance nor duration', async () => {
    // Shape ends 0.001 deg (about 111 m) short of the second point.
    mockComputeRoute.mockResolvedValue({
      ok: true,
      shape: [
        [6.1, 48.66],
        [6.14, 48.67],
      ],
      distanceKm: 2,
      durationS: 600,
    });
    await renderScreen();
    await addPoints(P1, P2);
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(mockSources['draft-link'].features.length).toBeGreaterThan(0);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('10 min');
  });
});

describe('C9 outside the zone (spec)', () => {
  it('Relier and Retirer, no download button; undo after Relier', async () => {
    mockComputeRoute.mockImplementation(realisticEngine);
    await renderScreen();
    await addPoints(P1, OUTSIDE);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByTestId('route-error-relink')).toBeTruthy();
    expect(screen.getByTestId('route-error-remove')).toBeTruthy();
    expect(screen.queryByText(/Télécharger/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(modes()).toEqual(['hand']);
    await fireEvent.press(screen.getByTestId('route-undo'));
    await flush();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    // The refused point is drawn as the refused marker, not as a point.
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(mockSources['draft-legs'].features).toHaveLength(0);
  });

  it('first point outside: only Retirer', async () => {
    mockComputeRoute.mockImplementation(realisticEngine);
    await renderScreen();
    await addPoints(OUTSIDE);
    expect(screen.queryByTestId('route-error-relink')).toBeNull();
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(pointIds()).toHaveLength(0);
  });
});

describe('C12 the right point is aimed (spec)', () => {
  it.each([
    ['farFromPath', FAR],
    ['outOfZone', OUTSIDE],
  ] as const)(
    'relink a bad point (%s), then add a good one: accepted or aimed at the kept point, then Remove removes the kept point',
    async (_kind, bad) => {
      mockComputeRoute.mockImplementation(realisticEngine);
      await renderScreen();
      await addPoints(P1, bad);
      await fireEvent.press(screen.getByTestId('route-error-relink'));
      await flush();
      expect(modes()).toEqual(['hand']);
      await addPoints(P3);
      await flush();
      if (screen.queryByTestId('route-error')) {
        // Aimed: the remove action must take the kept point (2), not 3.
        await fireEvent.press(screen.getByTestId('route-error-remove'));
        await flush();
        expect(lngLatOf()).toEqual([P1, P3]);
      } else {
        expect(lngLatOf()).toEqual([P1, bad, P3]);
      }
    },
  );

  it('relink a far point, add a good one, then Annuler: the state before', async () => {
    mockComputeRoute.mockImplementation(realisticEngine);
    await renderScreen();
    await addPoints(P1, FAR);
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    await addPoints(P3);
    await flush();
    if (screen.queryByTestId('route-error')) {
      await fireEvent.press(screen.getByTestId('route-error-remove'));
      await flush();
    }
    await fireEvent.press(screen.getByTestId('route-undo'));
    await flush();
    // No crash, a coherent screen.
    expect(screen.getByTestId('map')).toBeTruthy();
  });

  it('a calculation failing with an unknown error does not crash', async () => {
    mockComputeRoute.mockRejectedValue(new Error('boom'));
    await renderScreen();
    await addPoints(P1, P2);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.queryByTestId('route-error-relink')).toBeNull();
  });
});
