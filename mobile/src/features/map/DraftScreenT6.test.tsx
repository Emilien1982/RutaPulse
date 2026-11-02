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

const event = (at: [number, number]) => ({
  nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
});

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

const sizeOf = (node: { props: { style?: unknown } }) => {
  const style = StyleSheet.flatten(node.props.style as never) as {
    width: number;
    height: number;
  };
  return [style.width, style.height];
};

async function chooseMode(mode: 'hand' | 'path') {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`route-mode-${mode}`));
  });
}

describe('the chosen point is bigger (A1, mockup 10)', () => {
  it('a point that is not chosen keeps its round of 28 and has no halo', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    expect(sizeOf(screen.getByText('2').parent as never)).toEqual([28, 28]);
    expect(screen.queryByTestId('draft-marker-halo')).toBeNull();
  });

  it('a chosen point has a round of 40, a digit of 18 and a halo of 56', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onPress();
    });
    const digit = screen.getByText('2');
    expect(sizeOf(digit.parent as never)).toEqual([40, 40]);
    expect(StyleSheet.flatten(digit.props.style).fontSize).toBe(18);
    const halo = screen.getByTestId('draft-marker-halo');
    expect(sizeOf(halo)).toEqual([56, 56]);
    expect(StyleSheet.flatten(halo.props.style).backgroundColor).toBe(
      'rgba(194, 0, 122, 0.22)',
    );
  });

  it('the annotation is not drawn again during a drag, and is big after it', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onPress();
    });
    const id = pointIds()[1] as string;
    const mounts = { ...mockMounts };
    const node = screen.getByTestId(`annotation:${id}`);
    await act(async () => {
      mockAnnotations[id].onDragStart();
    });
    await act(async () => {
      mockAnnotations[id].onDrag(event([6.15, 48.69]));
    });
    expect(mockMounts).toEqual(mounts);
    expect(screen.getByTestId(`annotation:${id}`)).toBe(node);
    expect(sizeOf(screen.getByText('2').parent as never)).toEqual([40, 40]);
    await act(async () => {
      mockAnnotations[id].onDragEnd(event([6.15, 48.69]));
    });
    await flush();
    expect(sizeOf(screen.getByText('2').parent as never)).toEqual([40, 40]);
  });

  it('a chosen start and a chosen end are 40 too, with the halo', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    for (const n of [1, 3]) {
      await act(async () => {
        mockAnnotations[pointIds()[n - 1] as string].onPress();
      });
      const cell = screen.getByTestId(`draft-marker-${n}`);
      expect(sizeOf(screen.getByTestId('draft-marker-halo'))).toEqual([56, 56]);
      expect(sizeOf(cell.children[1] as never)).toEqual([40, 40]);
    }
  });

  it('the chosen round has the raised shadow of the mockup', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onPress();
    });
    const style = StyleSheet.flatten(screen.getByText('2').parent?.props.style);
    expect(style.shadowOffset).toEqual({ width: 0, height: 6 });
    expect(style.shadowRadius).toBe(12);
    expect(style.elevation).toBeGreaterThan(3);
  });

  it('a point dragged without being chosen keeps its key during the gesture', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    const id = pointIds()[1] as string;
    const mounts = { ...mockMounts };
    await act(async () => {
      mockAnnotations[id].onDragStart();
    });
    await act(async () => {
      mockAnnotations[id].onDrag(event([6.15, 48.69]));
    });
    expect(mockMounts).toEqual(mounts);
    expect(sizeOf(screen.getByText('2').parent as never)).toEqual([28, 28]);
  });
});

const HELP =
  'À la main : chaque touche ajoute un point, relié au précédent en ligne droite.';

describe('help bubble of the "À la main" mode (A2, mockup 11)', () => {
  it('is not there in the "Par les chemins" mode', async () => {
    await renderScreen();
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
    expect(screen.getByTestId('route-hint')).toBeTruthy();
  });

  it('shows on entering the mode, with the exact text, in place of the dark bubble', async () => {
    await renderScreen();
    await chooseMode('hand');
    expect(screen.getByTestId('route-hand-help')).toBeTruthy();
    expect(screen.getByText(HELP)).toBeTruthy();
    expect(screen.queryByTestId('route-hint')).toBeNull();
  });

  it('hides after the first touch on the map in this mode', async () => {
    await renderScreen();
    await chooseMode('hand');
    await addPoints(P1);
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
    expect(screen.getByTestId('route-hint')).toBeTruthy();
    await addPoints(P2);
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
  });

  it('shows again at a new passage in the mode', async () => {
    await renderScreen();
    await chooseMode('hand');
    await addPoints(P1);
    await chooseMode('path');
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
    await chooseMode('hand');
    expect(screen.getByTestId('route-hand-help')).toBeTruthy();
  });

  it('a drag of a point hides it, and the drag bubble shows', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await chooseMode('hand');
    expect(screen.getByTestId('route-hand-help')).toBeTruthy();
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onDragStart();
    });
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
    expect(screen.getByTestId('route-bubble-drag')).toBeTruthy();
  });

  it('touching a point hides it too', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await chooseMode('hand');
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onPress();
    });
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
    expect(screen.getByTestId('route-hint-drag')).toBeTruthy();
  });

  it('a touch in the other mode does not count', async () => {
    await renderScreen();
    await addPoints(P1);
    await chooseMode('hand');
    expect(screen.getByTestId('route-hand-help')).toBeTruthy();
  });
});

describe('note about the hand legs (A3, mockup 11)', () => {
  it('is not there without a hand leg', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await flush();
    expect(screen.queryByTestId('route-hand-note')).toBeNull();
  });

  it('shows the length of the hand legs, right of "PROCHAIN TRONÇON"', async () => {
    await renderScreen();
    await chooseMode('hand');
    await addPoints(P1, P2);
    await flush();
    // 0.04° of longitude and 0.02° of latitude: 3.7 km.
    expect(screen.getByTestId('route-hand-note')).toHaveTextContent(
      'À la main : 3,7 km',
    );
    expect(screen.getByText('PROCHAIN TRONÇON')).toBeTruthy();
  });

  it('with a path leg and a hand leg, shows the hand length only', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await chooseMode('hand');
    await addPoints(P3);
    await flush();
    // Path leg: 2 km (faked engine). Hand leg: 3.7 km. Total: 5.7 km.
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      '5,7\u202Fkm',
    );
    expect(screen.getByTestId('route-hand-note')).toHaveTextContent(
      'À la main\u00a0: 3,7\u202Fkm',
    );
  });

  it('is in meters under a kilometer', async () => {
    await renderScreen();
    await chooseMode('hand');
    await addPoints(P1, [6.1, 48.6645]);
    await flush();
    expect(screen.getByTestId('route-hand-note')).toHaveTextContent(
      'À la main : 500 m',
    );
  });
});
