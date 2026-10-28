import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';

// MapLibre, the router, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
const mockSources: Record<string, any> = {};
const mockAnnotations: Record<string, any> = {};
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();
const mockEaseTo = jest.fn();
let mockGranted = false;
let mockPosition:
  { coords: { longitude: number; latitude: number } } | undefined;
const mockBack = jest.fn();
const mockRepeat = jest.fn();
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
const P4: [number, number] = [6.2, 48.72];
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
  mockPrevent = undefined;
  mockParams = {};
  mockGranted = false;
  mockPosition = undefined;
  for (const key of Object.keys(mockSources)) delete mockSources[key];
  for (const key of Object.keys(mockAnnotations)) delete mockAnnotations[key];
  mockComputeRoute.mockResolvedValue(success());
});

describe('opening', () => {
  it('shows the top bar, the hint, the summary and the tools', async () => {
    await renderScreen();
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    expect(screen.getByText('Touchez le départ sur la carte')).toBeTruthy();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('0 m');
    // The minimal duration is one minute.
    expect(screen.getByTestId('route-duration')).toHaveTextContent('1 min');
    expect(screen.getByText('PROCHAIN TRONÇON')).toBeTruthy();
    expect(screen.getByText('Par les chemins')).toBeTruthy();
    expect(screen.getByText('À la main')).toBeTruthy();
    expect(screen.queryByText('Enregistrer')).toBeNull();
  });

  it('draws nothing but an empty background without a zone', async () => {
    mockInstalled = [];
    await renderScreen();
    expect(screen.queryByTestId('map')).toBeNull();
  });

  it('opens the camera on the view given by the map tab', async () => {
    mockParams = { lon: '6.1', lat: '48.6', zoom: '14' };
    await renderScreen();
    expect(screen.getByTestId('map')).toBeTruthy();
  });
});

describe('position', () => {
  it('shows "Ma position" under the bubble, at 64 under the top bar', async () => {
    await renderScreen();
    const button = screen.getByRole('button', {
      name: 'Recentrer sur ma position',
    });
    // The bar height is 112 until it is measured; the button sits at +64.
    expect(button.parent?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ top: 112 + 64 })]),
    );
    // Without permission: no blue dot.
    expect(screen.queryByTestId('user-location')).toBeNull();
  });

  it('draws the blue dot once the position is allowed', async () => {
    mockGranted = true;
    mockPosition = { coords: { longitude: 6.13, latitude: 48.66 } };
    await renderScreen();
    expect(screen.getByTestId('user-location')).toBeTruthy();
  });

  it('recenters the map on the position, at least at zoom 15', async () => {
    mockGranted = true;
    mockPosition = { coords: { longitude: 6.13, latitude: 48.66 } };
    await renderScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Recentrer sur ma position' }),
    );
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.13, 48.66], zoom: 15 }),
    );
  });
});

describe('adding points', () => {
  it('the first touch adds the start and asks for the end', async () => {
    await renderScreen();
    await addPoints(P1);
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(screen.getByText("Touchez l'arrivée sur la carte")).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('computes only the new leg, then sums the legs', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(mockComputeRoute.mock.calls[0]?.[0]).toEqual([
      { id: 1, lon: P1[0], lat: P1[1] },
      { id: 2, lon: P2[0], lat: P2[1] },
    ]);
    await addPoints(P3);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('4,0 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('20 min');
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
    expect(screen.getByLabelText('Point 2')).toBeTruthy();
  });

  it('keeps the previous figures, faded, while a leg is computed', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    let finish: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => (finish = resolve)),
    );
    await addPoints(P3);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('2,0 km');
    await act(async () => finish(success(1, 300)));
    await flush();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('3,0 km');
  });

  it('draws the legs in the legs source, in magenta data', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    expect(mockSources['draft-legs'].features).toHaveLength(1);
    expect(mockSources['draft-preview'].features).toHaveLength(0);
  });

  it('draws the dotted link when the leg stops short of the point', async () => {
    mockComputeRoute.mockResolvedValue({
      ok: true,
      shape: [
        [6.101, 48.661],
        [6.139, 48.679],
      ],
      distanceKm: 1,
      durationS: 60,
    });
    await renderScreen();
    await addPoints(P1, P2);
    expect(mockSources['draft-link'].features).toHaveLength(2);
  });
});

describe('choosing a point', () => {
  it('touching a point chooses it, with the help bubble, and no point is added', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    expect(screen.queryByTestId('route-hint-drag')).toBeNull();
    await pressAnnotation(2);
    expect(screen.getByLabelText('Point 2, choisi')).toBeTruthy();
    expect(screen.getByTestId('draft-marker-halo')).toBeTruthy();
    expect(
      screen.getByText('Maintenez le point, puis glissez-le'),
    ).toBeTruthy();
    expect(pointIds()).toHaveLength(3);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
  });

  it('a map touch right after a touch on a point adds nothing', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    const onPress = mockMapProps.onPress as (e: unknown) => void;
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onPress();
      onPress(event(P2));
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(pointIds()).toHaveLength(2);
  });

  it('a map touch just before a touch on a point adds nothing either', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    const onPress = mockMapProps.onPress as (e: unknown) => void;
    await act(async () => {
      onPress(event(P2));
      mockAnnotations[pointIds()[1] as string].onPress();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(pointIds()).toHaveLength(2);
    expect(screen.getByTestId('draft-marker-halo')).toBeTruthy();
  });

  it('touching it again lets it go', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await pressAnnotation(2);
    await pressAnnotation(2);
    expect(screen.queryByTestId('route-hint-drag')).toBeNull();
  });
});

describe('tools', () => {
  it('Supprimer needs a chosen point and joins the neighbours', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3, P4);
    expect(screen.getByTestId('route-delete')).toBeDisabled();
    await pressAnnotation(2);
    expect(screen.getByTestId('route-delete')).toBeEnabled();
    mockComputeRoute.mockClear();
    await fireEvent.press(screen.getByTestId('route-delete'));
    expect(pointIds()).toHaveLength(3);
    // Point 1 and the old point 3 are joined by one new leg.
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(mockComputeRoute.mock.calls[0]?.[0]).toEqual([
      { id: 1, lon: P1[0], lat: P1[1] },
      { id: 3, lon: P3[0], lat: P3[1] },
    ]);
    expect(screen.getByTestId('route-delete')).toBeDisabled();
  });

  it('renumbers the points after a removal', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3, P4);
    expect(screen.getByLabelText('Point 3')).toBeTruthy();
    await pressAnnotation(2);
    await fireEvent.press(screen.getByTestId('route-delete'));
    expect(screen.queryByLabelText('Point 3')).toBeNull();
    // The old point 3 is now the second one, with a new React key.
    expect(screen.getByLabelText('Point 2')).toBeTruthy();
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
  });

  it('Annuler is greyed without history, then undoes without a new calculation', async () => {
    await renderScreen();
    expect(screen.getByTestId('route-undo')).toBeDisabled();
    await addPoints(P1, P2, P3);
    expect(screen.getByTestId('route-undo')).toBeEnabled();
    await pressAnnotation(2);
    await fireEvent.press(screen.getByTestId('route-delete'));
    expect(pointIds()).toHaveLength(2);
    mockComputeRoute.mockClear();
    await fireEvent.press(screen.getByTestId('route-undo'));
    expect(pointIds()).toHaveLength(3);
    // The two legs come back from the cache of Query.
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('Boucler is greyed under 2 points, then adds the start at the end', async () => {
    await renderScreen();
    expect(screen.getByTestId('route-loop')).toBeDisabled();
    await addPoints(P1);
    expect(screen.getByTestId('route-loop')).toBeDisabled();
    await addPoints(P2);
    expect(screen.getByTestId('route-loop')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('route-loop'));
    expect(pointIds()).toHaveLength(3);
    expect(mockComputeRoute.mock.calls[1]?.[0]).toEqual([
      { id: 2, lon: P2[0], lat: P2[1] },
      { id: 3, lon: P1[0], lat: P1[1] },
    ]);
  });

  it('"À la main" sets the mode of the next leg: a straight line, no engine', async () => {
    await renderScreen();
    await addPoints(P1);
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    expect(screen.getByTestId('route-mode-hand')).toBeChecked();
    await addPoints(P2);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(mockSources['draft-legs'].features[0]).toMatchObject({
      properties: { mode: 'hand' },
      geometry: { coordinates: [P1, P2] },
    });
    // The distance of the straight line is counted (about 3.7 km). The
    // matcher folds the narrow space into a plain one.
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      /^3,[0-9] km$/,
    );
    await fireEvent.press(screen.getByTestId('route-mode-path'));
    await addPoints(P3);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
  });
});

describe('errors', () => {
  it('a leg that fails opens the error sheet on the last point', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'farFromPath' });
    await addPoints(P2);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.getByText('Aucun chemin trouvé')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(screen.queryByTestId('route-edge-label')).toBeNull();
    expect(screen.queryByTestId('route-summary')).toBeNull();
    expect(pointIds()).toHaveLength(1);
  });

  it('"Retirer ce point" removes the refused point and closes the sheet', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'failed' });
    await addPoints(P2);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.getByTestId('route-summary')).toBeTruthy();
    expect(pointIds()).toHaveLength(1);
  });

  it('refuses a first point outside the zone at once, with the label on the edge', async () => {
    await renderScreen();
    await addPoints(OUTSIDE);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(screen.getByText('Hors de la zone')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.getByText('Touchez le départ sur la carte')).toBeTruthy();
  });

  it('ignores the touches on the map while the error sheet is open', async () => {
    await renderScreen();
    await addPoints(OUTSIDE);
    await addPoints(P1);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(pointIds()).toHaveLength(0);
  });

  it('does not crash when the engine rejects', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockRejectedValue(new Error('boom'));
    await addPoints(P2);
    expect(screen.getByText('Calcul impossible')).toBeTruthy();
  });
});

describe('dragging a point', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    // No React warning, e.g. "Cannot update a component while rendering".
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  async function dragStart(n: number) {
    await act(async () => {
      mockAnnotations[pointIds()[n - 1] as string].onDragStart();
    });
  }
  async function dragTo(n: number, at: [number, number]) {
    await act(async () => {
      mockAnnotations[pointIds()[n - 1] as string].onDrag(event(at));
    });
  }
  async function dragEnd(n: number, at: [number, number]) {
    await act(async () => {
      mockAnnotations[pointIds()[n - 1] as string].onDragEnd(event(at));
    });
    await flush();
  }

  it('previews the two legs next to the point, in their own source', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    mockComputeRoute.mockClear();
    const moved: RouteResult = {
      ok: true,
      shape: [
        [6.15, 48.67],
        [6.16, 48.69],
      ],
      distanceKm: 1,
      durationS: 60,
    };
    mockComputeRoute.mockResolvedValue(moved);
    await dragStart(2);
    // Before the first answer, the old shapes are in the preview source.
    expect(mockSources['draft-preview'].features).toHaveLength(2);
    expect(mockSources['draft-legs'].features).toHaveLength(0);
    await dragTo(2, [6.15, 48.69]);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(
      mockSources['draft-preview'].features[0].geometry.coordinates,
    ).toEqual(moved.ok && moved.shape);
  });

  it('at the release, keeps the preview until the final result, then clears it', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    await dragTo(2, [6.15, 48.69]);
    let finish: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => (finish = resolve)),
    );
    await dragEnd(2, [6.16, 48.7]);
    // The point has moved; the legs are waiting: the preview is still there.
    expect(mockAnnotations[pointIds()[1] as string].lngLat).toEqual([
      6.16, 48.7,
    ]);
    expect(mockSources['draft-preview'].features.length).toBeGreaterThan(0);
    await act(async () => finish(success()));
    await flush();
    expect(mockSources['draft-preview'].features).toHaveLength(0);
    expect(mockSources['draft-legs'].features).toHaveLength(2);
  });

  it('clears the preview when the release changes nothing', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    expect(mockSources['draft-preview'].features.length).toBeGreaterThan(0);
    mockComputeRoute.mockClear();
    await dragEnd(2, P2);
    expect(mockSources['draft-preview'].features).toHaveLength(0);
    expect(mockSources['draft-legs'].features).toHaveLength(2);
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('after the final result, the preview is gone and a new gesture starts clean', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    await dragTo(2, [6.15, 48.69]);
    await dragEnd(2, [6.16, 48.7]);
    await flush();
    expect(mockSources['draft-preview'].features).toHaveLength(0);
    expect(mockSources['draft-legs'].features).toHaveLength(2);
    // A second gesture does not start from the preview of the first.
    await dragStart(2);
    expect(mockSources['draft-preview'].features).toHaveLength(2);
    await dragEnd(2, [6.16, 48.7]);
    expect(mockSources['draft-preview'].features).toHaveLength(0);
  });

  it('an error at the release shows the sheet and no preview', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    await dragTo(2, [6.15, 48.69]);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'farFromPath' });
    await dragEnd(2, [6.16, 48.7]);
    expect(screen.getByText('Aucun chemin trouvé')).toBeTruthy();
    expect(mockSources['draft-preview'].features).toHaveLength(0);
    // The refused point is the dragged one, not the last added.
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(pointIds()).toHaveLength(2);
  });

  it('a failed preview keeps the old line of the leg', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    await dragStart(2);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'failed' });
    await dragTo(2, [6.15, 48.69]);
    expect(mockSources['draft-preview'].features).toHaveLength(2);
    expect(screen.queryByTestId('route-error')).toBeNull();
  });
});

describe('touches and gestures', () => {
  const press = (at: [number, number]) =>
    (mockMapProps.onPress as (e: unknown) => void)(event(at));
  const wait = (ms: number) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });

  it('two quick touches on the map, under 120 ms apart, add two points', async () => {
    await renderScreen();
    await act(async () => {
      press(P1);
      await new Promise((resolve) => setTimeout(resolve, 40));
      press(P2);
    });
    await wait(250);
    expect(pointIds()).toHaveLength(2);
  });

  it('a touch on a point empties the whole queue of touches', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await act(async () => {
      press(P3);
      press(P4);
      mockAnnotations[pointIds()[0] as string].onPress();
    });
    await wait(250);
    expect(pointIds()).toHaveLength(2);
  });

  it('a queued touch adds nothing if an error sheet opened meanwhile', async () => {
    await renderScreen();
    await addPoints(P1);
    let fail: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => (fail = resolve)),
    );
    await addPoints(P2);
    await act(async () => press(P3));
    await act(async () => fail({ ok: false, error: 'farFromPath' }));
    await wait(250);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    // Only the first point is left: the queued touch was dropped.
    expect(pointIds()).toHaveLength(1);
  });

  it('ignores the touches on the map during a gesture', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onDragStart();
    });
    await act(async () => press(P3));
    await wait(250);
    expect(pointIds()).toHaveLength(2);
  });

  it('a gesture whose point is refused meanwhile falls back cleanly', async () => {
    await renderScreen();
    await addPoints(P1);
    let fail: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => (fail = resolve)),
    );
    await addPoints(P2);
    // The user holds point 2 while its leg fails: it becomes the refused point.
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onDragStart();
    });
    await act(async () => fail({ ok: false, error: 'farFromPath' }));
    await flush();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(mockSources['draft-preview'].features).toHaveLength(0);
    // The gesture is over: after "Retirer ce point", the map takes touches.
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    mockComputeRoute.mockResolvedValue(success());
    await wait(350);
    await addPoints(P3);
    expect(pointIds()).toHaveLength(2);
  });

  it('a gesture whose annotation is drawn again falls back cleanly', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    mockComputeRoute.mockClear();
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onDragStart();
    });
    expect(mockSources['draft-preview'].features.length).toBeGreaterThan(0);
    // "Boucler" turns point 2 from the arrival into a numbered point: its
    // React key changes, the annotation is drawn again, the gesture is lost.
    await fireEvent.press(screen.getByTestId('route-loop'));
    expect(mockSources['draft-preview'].features).toHaveLength(0);
    // The touch of the annotation blocks the map for a moment: let it pass.
    await wait(350);
    await addPoints(P3);
    expect(pointIds()).toHaveLength(4);
  });

  it('a "by hand" leg next to the dragged point follows it as a straight line', async () => {
    await renderScreen();
    await addPoints(P1);
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P2);
    await fireEvent.press(screen.getByTestId('route-mode-path'));
    await addPoints(P3);
    mockComputeRoute.mockClear();
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onDragStart();
    });
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onDrag(event([6.15, 48.69]));
    });
    const lines = mockSources['draft-preview'].features.map(
      (f: any) => f.geometry.coordinates,
    );
    expect(lines).toContainEqual([P1, [6.15, 48.69]]);
    // Only the leg by the paths is computed by the engine.
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
  });
});

describe('leaving', () => {
  it('the cross goes back without a question under 2 points', async () => {
    await renderScreen();
    await addPoints(P1);
    expect(mockPrevent?.value).toBe(false);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Fermer sans enregistrer' }),
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('blocks the way out from 2 points and asks in a native dialog', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    await addPoints(P1, P2);
    expect(mockPrevent?.value).toBe(true);
    mockPrevent?.callback({ data: { action: {} }, repeat: mockRepeat });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]?.[0]).toBe('Abandonner cet itinéraire ?');
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['Continuer', 'Abandonner']);
    // "Continuer" does nothing; "Abandonner" repeats the blocked action.
    buttons[0]?.onPress?.();
    expect(mockRepeat).not.toHaveBeenCalled();
    await act(async () => buttons[1]?.onPress?.());
    expect(mockRepeat).toHaveBeenCalledTimes(1);
    expect(mockPrevent?.value).toBe(false);
    alert.mockRestore();
  });
});
