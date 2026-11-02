// Tester's tests for T4 of phase 5 (spec C4, C6, C10; ADR 0017, sections 5, 6
// and 8). Written from the spec and the ADR; they complete
// DraftScreenInfosT4.test.tsx and useLegInfos.test.tsx, they do not repeat them.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

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

beforeEach(() => {
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

const dragEvent = (at: [number, number]) => ({
  nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
});

async function drag(n: number, to: [number, number], middle?: () => void) {
  const id = pointIds()[n - 1] as string;
  await act(async () => {
    mockAnnotations[id].onDragStart();
  });
  await act(async () => {
    mockAnnotations[id].onDrag?.(dragEvent(to));
  });
  middle?.();
  await act(async () => {
    mockAnnotations[id].onDragEnd(dragEvent(to));
  });
  await flush();
}

// Altitudes given one by one (the engine answers 30 m apart).
function heights(...values: (number | null)[]) {
  return {
    ok: true,
    profile: values.map((h, i) => [i * 30, h]),
  };
}

describe('T4 tester: ascent (D+) in the summary (C6)', () => {
  it('shows a general case: 100, 103, 110, 108, 120 m give "20 m" and the order is distance, D+, duration', async () => {
    // Expected 20 m by hand, with the rule of ADR 0017, section 4 (threshold
    // of 5 m, reference = last kept altitude): 103 is +3 (ignored); 110 is
    // +10 (kept, ref 110); 108 is -2 (ignored); 120 is +10 (kept): 10 + 10.
    mockHeights.mockResolvedValue(heights(100, 103, 110, 108, 120));
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.getByTestId('route-ascent').children).toEqual([
      '20',
      expect.anything(),
    ]);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('20 m');
    const order = screen
      .getAllByTestId(/^route-(distance|ascent|duration)$/)
      .map((node) => node.props.testID);
    expect(order).toEqual(['route-distance', 'route-ascent', 'route-duration']);
  });

  it('a flat profile gives "0 m", not a dash', async () => {
    mockHeights.mockResolvedValue(heights(250, 251, 250, 252));
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('0 m');
  });

  it('an altitude "null" in the profile gives a dash (all or nothing, ADR 0017 section 8)', async () => {
    mockHeights.mockResolvedValue(heights(100, null, 140));
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    expect(figures().opacity).toBeUndefined();
  });

  it('a rejected altitude request gives a dash and nothing stays pending', async () => {
    mockHeights.mockRejectedValue(new Error('boom'));
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    await flush();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    expect(figures().opacity).toBeUndefined();
  });

  it('when only the terrain fails, the D+ is still shown', async () => {
    mockTerrain.mockResolvedValue({ ok: false, error: 'failed' });
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21 m');
    expect(figures().opacity).toBeUndefined();
  });

  it('the first figures come in one go: dashes while the altitudes are pending, then all three together', async () => {
    let answer: (r: unknown) => void = () => {};
    mockHeights.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    // The route is known (2,0 km) but the altitudes are not: no figure yet.
    for (const id of ['route-distance', 'route-ascent', 'route-duration']) {
      expect(screen.getByTestId(id)).toHaveTextContent('—');
    }
    await act(async () => answer(profile(21)));
    await flush();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21 m');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('10 min');
  });

  it('a route that fails: no height call, an error sheet, no figure stuck faded', async () => {
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'farFromPath' });
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    await flush();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
    // Relinking by hand: the figures come back, with a D+ or a dash.
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(figures().opacity).toBeUndefined();
    expect(screen.getByTestId('route-distance')).toHaveTextContent(/km$/);
  });
});

describe('T4 tester: nothing computed during a drag (C6, ADR 0017 section 6)', () => {
  it('no height or terrain call between the start of the drag and the release; calls after it', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await flush();
    mockHeights.mockClear();
    mockTerrain.mockClear();
    mockComputeRoute.mockClear();
    let during = [-1, -1, -1];
    await drag(2, [6.15, 48.69], () => {
      during = [
        mockHeights.mock.calls.length,
        mockTerrain.mock.calls.length,
        mockComputeRoute.mock.calls.length,
      ];
    });
    // During the drag: not one call (the preview does not use the cache).
    expect(during[0]).toBe(0);
    expect(during[1]).toBe(0);
    // After the release: the 2 legs around point 2 are recomputed.
    expect(mockHeights).toHaveBeenCalledTimes(2);
    expect(mockTerrain).toHaveBeenCalledTimes(2);
  });

  it('the D+ is not greyed during the drag, and is greyed after the release while the altitudes are computed', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    const id = pointIds()[1] as string;
    mockHeights.mockReturnValue(new Promise(() => undefined));
    await act(async () => {
      mockAnnotations[id].onDragStart();
    });
    await act(async () => {
      mockAnnotations[id].onDrag?.(dragEvent(P3));
    });
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21 m');
    expect(figures().opacity).toBeUndefined();
    await act(async () => {
      mockAnnotations[id].onDragEnd(dragEvent(P3));
    });
    await flush();
    expect(figures().opacity).toBeLessThan(1);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21 m');
  });

  it('"Annuler" after a move calls neither the engine, nor height, nor traceAttributes (keys in cache)', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    await drag(2, P3);
    mockHeights.mockClear();
    mockTerrain.mockClear();
    mockComputeRoute.mockClear();
    await fireEvent.press(screen.getByTestId('route-undo'));
    await flush();
    await flush();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21 m');
    expect(figures().opacity).toBeUndefined();
  });
});

describe('T4 tester: hand legs (C4, ADR 0017 section 5)', () => {
  it('a hand leg with an end outside the zone: no height call, a dash, nothing stuck', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    mockHeights.mockClear();
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints([7.5, 48.7]);
    await flush();
    await flush();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('route-distance')).toHaveTextContent(/km$/);
    expect(figures().opacity).toBeUndefined();
  });

  it('a hand leg inside the zone is measured on the straight line [from, to], without terrain, and raises the D+', async () => {
    // First leg by path: 200 -> 221 m (+21). Hand leg: 221 -> 236 m (+15).
    // Joined profile (ADR 0017, section 4): 200, 221, 221, 236: +21 then
    // +15 = 36 m (by hand).
    mockHeights.mockImplementation(async (shape: [number, number][]) =>
      shape[0]?.[0] === P2[0] ? heights(221, 236) : heights(200, 221),
    );
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('21 m');
    mockHeights.mockClear();
    mockTerrain.mockClear();
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P3);
    await flush();
    await flush();
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(mockHeights.mock.calls[0]?.[0]).toEqual([P2, P3]);
    expect(mockTerrain).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('36 m');
    expect(figures().opacity).toBeUndefined();
  });
});
