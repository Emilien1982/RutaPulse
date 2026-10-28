import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { t } from '@/core/i18n/t';
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
let mockPrevent: { value: boolean; callback: (o: any) => void } | undefined;
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
  usePreventRemove: (value: boolean, callback: (o: any) => void) => {
    mockPrevent = { value, callback };
  },
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

// Decision B1 (p04-t7): at the start of the drag of another point the choice
// is emptied; once released, the dragged point is the chosen one.
describe('B1: choose 2, drag 3, delete', () => {
  it('removes point 3 and keeps points 1 and 2', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    const ids = pointIds();
    await pressAnnotation(2);
    expect(screen.getByLabelText('Point 2, choisi')).toBeTruthy();
    await dragStart(3);
    // During the drag nothing is chosen any more.
    expect(screen.queryByLabelText('Point 2, choisi')).toBeNull();
    expect(screen.queryAllByTestId('draft-marker-halo')).toHaveLength(0);
    await dragEnd(3, [6.19, 48.71]);
    await fireEvent.press(screen.getByTestId('route-delete'));
    expect(pointIds()).toEqual([ids[0], ids[1]]);
  });

  it('makes the dragged point the chosen one after the release', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    await dragEnd(2, [6.15, 48.69]);
    expect(screen.getByLabelText('Point 2, choisi')).toBeTruthy();
    expect(screen.getAllByTestId('draft-marker-halo')).toHaveLength(1);
    // Deleting now removes the dragged point 2, not another one.
    const ids = pointIds();
    await fireEvent.press(screen.getByTestId('route-delete'));
    expect(pointIds()).toEqual([ids[0], ids[2]]);
  });

  it('moves the choice from the dragged point to the next dragged one', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    await dragEnd(2, [6.15, 48.69]);
    await dragStart(3);
    expect(screen.queryByLabelText('Point 2, choisi')).toBeNull();
    await dragEnd(3, [6.19, 48.71]);
    expect(screen.getByLabelText('Arrivée, choisie')).toBeTruthy();
    expect(screen.queryByLabelText('Point 2, choisi')).toBeNull();
  });
});

// Decision A4 (p04-t7): a dash of the size of a digit, no unit, under 2
// points and while no figure is known.
describe('A4: the dash', () => {
  function expectDashes() {
    for (const id of ['route-distance', 'route-duration']) {
      const node = screen.getByTestId(id);
      expect(node.children).toEqual(['—']);
      const style = StyleSheet.flatten(node.props.style);
      expect(style.fontSize).toBe(28);
      expect(style.fontWeight).toBe('800');
    }
  }

  it('shows at 0 point', async () => {
    await renderScreen();
    expectDashes();
    expect(screen.queryByText('0 m')).toBeNull();
    expect(screen.queryByText(/^\d+\s*min$/)).toBeNull();
  });

  it('shows at 1 point', async () => {
    await renderScreen();
    await addPoints(P1);
    expectDashes();
  });

  it('shows during the first computation, then gives way to the figures', async () => {
    let answer: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => {
        answer = resolve;
      }),
    );
    await renderScreen();
    await addPoints(P1, P2);
    expectDashes();
    await act(async () => {
      answer(success(2, 600));
    });
    await flush();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('10 min');
  });

  it('keeps the known figures (no dash) while a next leg is computed', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    mockComputeRoute.mockReturnValue(new Promise(() => {}));
    await addPoints(P3);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
  });

  it('comes back when the points are removed down to 1', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await pressAnnotation(2);
    await fireEvent.press(screen.getByTestId('route-delete'));
    expectDashes();
  });

  it('is read as "pas encore d\'itinéraire", with a no-break space before the colon', async () => {
    await renderScreen();
    expect(
      screen.getByLabelText("Distance : pas encore d'itinéraire"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Durée estimée : pas encore d'itinéraire"),
    ).toBeTruthy();
  });

  it('has no such label once the figures are known', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    expect(screen.queryByLabelText(/pas encore/)).toBeNull();
  });
});

// Decision M3 (p04-t7): U+202F before "?", U+00A0 before ":".
describe('M3: no-break spaces', () => {
  it('uses U+202F before the "?" of the Abandon box, U+00A0 before its colon', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    await addPoints(P1, P2);
    // The way out is blocked: the screen asks instead of leaving.
    expect(mockPrevent?.value).toBe(true);
    mockPrevent?.callback({ data: { action: {} }, repeat: jest.fn() });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]?.[0]).toBe('Abandonner cet itinéraire ?');
    expect(alert.mock.calls[0]?.[1]).toBe(
      "Rien n'est encore enregistré : les points posés seront perdus.",
    );
  });

  it('uses U+00A0 in the drag bubble', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(3);
    expect(screen.getByText('Point 3 : relâchez pour le poser')).toBeTruthy();
  });

  it('uses U+00A0 in the label of "Boucler"', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    expect(
      screen.getByLabelText('Boucler : ajoute le départ comme dernier point'),
    ).toBeTruthy();
  });

  it.each([
    ['zones.deleteTitle', 'Supprimer la zone Nancy ?', { name: 'Nancy' }],
    [
      'zones.menuLabel',
      'Actions de la zone Nancy : supprimer',
      { name: 'Nancy' },
    ],
    [
      'zones.noSpace',
      'Place insuffisante : il faut 80 Mo libres.',
      {
        needed: '80 Mo',
      },
    ],
    ['zones.noWifiBanner', 'Pas de Wi-Fi :', undefined],
  ] as const)('texts %s', (key, expected, params) => {
    expect(t(key, params as Record<string, string> | undefined)).toBe(expected);
  });
});
