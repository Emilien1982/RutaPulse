import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftInSession } from './testing/DraftInSession';

// MapLibre, the router, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
const mockSources: Record<string, any> = {};
const mockAnnotations: Record<string, any> = {};
const mockMounts: Record<string, number> = {};
const mockMarkers: Record<string, any> = {};
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
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
    Marker: (props: { id: string; children: ReactNode }) => {
      mockMarkers[props.id] = props;
      return <>{props.children}</>;
    },
    ViewAnnotation: (props: { id: string; children: ReactNode }) => {
      const { useEffect } = jest.requireActual('react');
      useEffect(() => {
        mockMounts[props.id] = (mockMounts[props.id] ?? 0) + 1;
      }, [props.id]);
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
  usePreventRemove: () => undefined,
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
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: (...args: unknown[]) => mockHeights(...args),
  computeTerrain: (...args: unknown[]) => mockTerrain(...args),
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

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftInSession />
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

// Altitudes with an ascent of `up` meters (threshold of 5 m, ADR 0017).
function profile(up: number) {
  return {
    ok: true,
    profile: [
      [0, 200],
      [30, 200 + up],
    ],
  };
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

const event = (at: [number, number]) => ({
  nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
});

// The summary is compact under 390 dp (p05-t8, decision 2); these suites
// check the normal summary, on a usual phone (411 dp, text scale 1).
let windowSpy: jest.SpyInstance;
afterEach(() => windowSpy.mockRestore());

beforeEach(() => {
  windowSpy = jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width: 411, height: 900, scale: 1, fontScale: 1 });
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockParams = {};
  mockGranted = false;
  mockPosition = undefined;
  for (const key of Object.keys(mockSources)) delete mockSources[key];
  for (const key of Object.keys(mockAnnotations)) delete mockAnnotations[key];
  for (const key of Object.keys(mockMounts)) delete mockMounts[key];
  for (const key of Object.keys(mockMarkers)) delete mockMarkers[key];
  mockComputeRoute.mockResolvedValue(success());
  mockHeights.mockResolvedValue(profile(21));
  mockTerrain.mockResolvedValue({
    ok: true,
    edges: [{ use: 'track', density: 0, lengthKm: 2 }],
  });
});

const figures = () =>
  StyleSheet.flatten(screen.getByTestId('route-figures').props.style);

async function dragEnd(n: number, at: [number, number]) {
  await act(async () => {
    mockAnnotations[pointIds()[n - 1] as string].onDragStart();
  });
  await act(async () => {
    mockAnnotations[pointIds()[n - 1] as string].onDragEnd(event(at));
  });
  await flush();
}

describe('ascent (D+) in the creation summary (mockup 10)', () => {
  it('shows the exact text, between the distance and the duration', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      '2,0\u202Fkm',
    );
    expect(screen.getByTestId('route-ascent').children).toEqual([
      '21',
      expect.anything(),
    ]);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21\u202Fm');
    expect(screen.getByText('Montée (D+)')).toBeTruthy();
    expect(figures().opacity).toBeUndefined();
  });

  it('is a dash before the first figures and under 2 points', async () => {
    await renderScreen();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
    await addPoints(P1);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
  });

  it('changes in one go with the distance: the old figures stay, faded, until the altitudes come', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    let answer: (r: unknown) => void = () => {};
    mockHeights.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    mockComputeRoute.mockResolvedValue(success(3, 900));
    await dragEnd(2, P3);
    // The route is known, the altitudes are not: nothing has changed yet.
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      '2,0\u202Fkm',
    );
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21\u202Fm');
    expect(figures().opacity).toBeLessThan(1);
    await act(async () => answer(profile(40)));
    await flush();
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      '3,0\u202Fkm',
    );
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('40\u202Fm');
    expect(figures().opacity).toBeUndefined();
  });

  it('keeps the previous D+, faded, while the route is computed after a drag', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    mockComputeRoute.mockReturnValue(new Promise(() => undefined));
    mockHeights.mockClear();
    await dragEnd(2, P3);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21\u202Fm');
    expect(figures().opacity).toBeLessThan(1);
    expect(mockHeights).not.toHaveBeenCalled();
  });

  it('is a dash when the altitudes are missing, and the figures are not stuck', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      '2,0\u202Fkm',
    );
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
    expect(figures().opacity).toBeUndefined();
  });

  it('a hand leg outside the zone gives a dash and no height call', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P1, [7.5, 48.7]);
    await flush();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
  });
});
