import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';

// MapLibre, the router, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
const mockSources: Record<string, any> = {};
const mockAnnotations: Record<string, any> = {};
const mockMounts: Record<string, number> = {};
const mockMarkers: Record<string, any> = {};
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
const OUTSIDE: [number, number] = [7.5, 48.7];

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

async function pressAnnotation(n: number, ids = pointIds()) {
  await act(async () => {
    mockAnnotations[ids[n - 1] as string].onPress();
  });
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
});

describe('T8: a dragged point becomes the chosen one', () => {
  async function dragStart(n: number) {
    await act(async () => {
      mockAnnotations[pointIds()[n - 1] as string].onDragStart();
    });
  }
  async function dragEnd(n: number, at: [number, number]) {
    await act(async () => {
      mockAnnotations[pointIds()[n - 1] as string].onDragEnd(event(at));
    });
    await flush();
  }

  it('empties the choice of another point when its gesture starts, without cutting it', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await pressAnnotation(1);
    expect(screen.getByLabelText('Départ, choisi')).toBeTruthy();
    const draggedId = pointIds()[2] as string;
    const before = mockMounts[draggedId];
    await dragStart(3);
    // The choice is gone (halo and "Supprimer" included) ...
    expect(screen.queryByTestId('draft-marker-halo')).toBeNull();
    expect(screen.queryByLabelText('Départ, choisi')).toBeNull();
    // ... and the dragged annotation was not drawn again.
    expect(mockMounts[draggedId]).toBe(before);
    expect(pointIds()[2]).toBe(draggedId);
  });

  it('chooses the dragged point once released: halo, help bubble, and "Supprimer" targets it', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    const ids = pointIds();
    await pressAnnotation(1);
    await dragStart(3);
    await dragEnd(3, [6.19, 48.71]);
    expect(screen.getAllByTestId('draft-marker-halo')).toHaveLength(1);
    expect(screen.getByLabelText('Arrivée, choisie')).toBeTruthy();
    expect(screen.getByTestId('route-hint-drag')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('route-delete'));
    // The dragged point (the 3rd) is the one that went.
    expect(pointIds()).toEqual([ids[0], ids[1]]);
    expect(screen.getByLabelText('Départ')).toBeTruthy();
  });

  it('keeps the choice of the point that is dragged, without drawing it again', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await pressAnnotation(2);
    const id = pointIds()[1] as string;
    const before = mockMounts[id];
    await dragStart(2);
    expect(screen.getByLabelText('Point 2, choisi')).toBeTruthy();
    expect(mockMounts[id]).toBe(before);
    await dragEnd(2, [6.15, 48.69]);
    expect(screen.getAllByTestId('draft-marker-halo')).toHaveLength(1);
    expect(screen.getByLabelText('Point 2, choisi')).toBeTruthy();
  });

  it('chooses the dragged point when nothing was chosen before', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    await dragEnd(2, [6.15, 48.69]);
    expect(screen.getByLabelText('Point 2, choisi')).toBeTruthy();
  });
});

describe('T8: empty summary', () => {
  it('shows dashes under 2 points, with an accessibility label', async () => {
    await renderScreen();
    for (const id of ['route-distance', 'route-duration']) {
      expect(screen.getByTestId(id)).toHaveTextContent('—');
    }
    expect(
      screen.getByLabelText("Distance\u00A0: pas encore d'itinéraire"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Durée estimée\u00A0: pas encore d'itinéraire"),
    ).toBeTruthy();
    // The dash is a value (28, 800), not a unit (17, 700).
    const dash = StyleSheet.flatten(
      screen.getByTestId('route-distance').props.style,
    );
    expect(dash.fontSize).toBe(28);
    expect(dash.fontWeight).toBe('800');
    // No nested Text (it would carry the unit style, 17): the dash is the
    // only child of the value element.
    for (const id of ['route-distance', 'route-duration']) {
      expect(screen.getByTestId(id).children).toEqual(['—']);
    }
    await addPoints(P1);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('—');
    await addPoints(P2);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('10 min');
  });
});

describe('T8: first leg being computed', () => {
  it('keeps the dashes until a figure is known', async () => {
    mockComputeRoute.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await addPoints(P1, P2);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('—');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('—');
  });
});

describe('T8: label of the refused point', () => {
  it('sits along the edge, under the point, on 84 at most', async () => {
    await renderScreen();
    await addPoints(OUTSIDE);
    const label = mockMarkers['draft-edge-label'];
    expect(label.anchor).toBe('top-left');
    expect(label.offset).toEqual([10, 24]);
    expect(
      StyleSheet.flatten(screen.getByTestId('route-edge-label').props.style)
        .maxWidth,
    ).toBe(84);
  });

  it.each([
    ['west', [5.5, 48.7], 'top-right', [-10, 24]],
    ['north', [6.2, 49.3], 'bottom-left', [24, -10]],
    ['south', [6.2, 48.1], 'top-left', [24, 10]],
  ] as const)(
    'is placed along the %s edge',
    async (_name, at, anchor, offset) => {
      await renderScreen();
      await addPoints([at[0], at[1]]);
      const label = mockMarkers['draft-edge-label'];
      expect(label.anchor).toBe(anchor);
      expect(label.offset).toEqual(offset);
    },
  );
});
