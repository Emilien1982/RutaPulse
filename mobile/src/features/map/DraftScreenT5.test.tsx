import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { fr } from '@/core/i18n/fr';
import { handLeg } from '@/core/draft/legs';
import { formatDistance, formatDuration } from '@/core/routing/formatRoute';
import { MAX_SNAP_METERS } from '@/core/routing/routeRequest';

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
  mockComputeRoute.mockResolvedValue(success());
});

const lngLatOf = () =>
  pointIds().map((id) => (mockAnnotations[id] as { lngLat: number[] }).lngLat);

const press = (at: [number, number]) =>
  (mockMapProps.onPress as (e: unknown) => void)(event(at));
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

describe('relink by hand (T5)', () => {
  it('"Relier" is one action on all the failed legs of the point, undone at once', async () => {
    await renderScreen();
    await addPoints(P1);
    // Two quick touches while the engine answers nothing yet.
    const answers: ((r: RouteResult) => void)[] = [];
    mockComputeRoute.mockImplementation(
      () => new Promise<RouteResult>((resolve) => answers.push(resolve)),
    );
    await act(async () => {
      press(P2);
      await new Promise((resolve) => setTimeout(resolve, 160));
      press(P3);
    });
    await wait(200);
    expect(answers).toHaveLength(2);
    await act(async () => {
      for (const answer of answers) answer({ ok: false, error: 'farFromPath' });
    });
    await flush();
    expect(screen.getByText('Aucun chemin trouvé')).toBeTruthy();
    const calls = mockComputeRoute.mock.calls.length;

    await fireEvent.press(screen.getByTestId('route-error-relink'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    // The engine is not called for the hand legs.
    expect(mockComputeRoute.mock.calls).toHaveLength(calls);
    const legs = mockSources['draft-legs'].features;
    expect(legs.map((f: any) => f.properties.mode)).toEqual(['hand', 'hand']);
    expect(legs[0].geometry.coordinates).toEqual([P1, P2]);
    // Distance counted, duration estimated at 10 km/h.
    expect(screen.getByTestId('route-distance')).toHaveTextContent(/km$/);
    expect(screen.getByTestId('route-duration')).not.toHaveTextContent('1 min');

    // One "Annuler" brings back both legs (the engine fails again).
    mockComputeRoute.mockReset();
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'farFromPath' });
    await fireEvent.press(screen.getByTestId('route-undo'));
    await flush();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(mockSources['draft-legs'].features).toHaveLength(0);
    // And one "Relier" again, after the undo, is still one action.
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    expect(mockSources['draft-legs'].features).toHaveLength(2);
  });

  it('undo after "Relier" brings back the failed legs and the sheet', async () => {
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'farFromPath' });
    await renderScreen();
    await addPoints(P1, P2);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    await fireEvent.press(screen.getByTestId('route-undo'));
    await flush();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(mockSources['draft-legs'].features).toHaveLength(0);
  });

  it.each(['remove', 'relink'])(
    'with two failed legs, "%s" acts on the shared point',
    async (way) => {
      const failOnP2 = (points: { lon: number }[]) =>
        Promise.resolve(
          points.some((p) => p.lon === P2[0])
            ? ({ ok: false, error: 'farFromPath' } as RouteResult)
            : success(),
        );
      await renderScreen();
      await addPoints(P1);
      const waiting: (() => void)[] = [];
      mockComputeRoute.mockImplementation(
        (points: { lon: number }[]) =>
          new Promise<RouteResult>((resolve) => {
            waiting.push(() => void failOnP2(points).then(resolve));
          }),
      );
      await act(async () => {
        press(P2);
        await new Promise((resolve) => setTimeout(resolve, 160));
        press(P3);
      });
      await wait(200);
      await act(async () => waiting.forEach((release) => release()));
      await flush();
      expect(screen.getByTestId('route-error')).toBeTruthy();
      mockComputeRoute.mockImplementation(failOnP2);
      if (way === 'remove') {
        // Removing the shared point (2), not the last one (3).
        await fireEvent.press(screen.getByTestId('route-error-remove'));
        await flush();
        expect(screen.queryByTestId('route-error')).toBeNull();
        expect(lngLatOf()).toEqual([P1, P3]);
      } else {
        // Relinking: both legs of point 2 go by hand, all 3 points stay.
        await fireEvent.press(screen.getByTestId('route-error-relink'));
        await flush();
        expect(screen.queryByTestId('route-error')).toBeNull();
        expect(lngLatOf()).toEqual([P1, P2, P3]);
        expect(
          mockSources['draft-legs'].features.map((f: any) => f.properties.mode),
        ).toEqual(['hand', 'hand']);
      }
    },
  );

  it('a point outside the zone: "Relier" draws the dashed leg, with no engine call', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'outOfZone' });
    await addPoints(OUTSIDE);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByTestId('route-error-relink')).toBeTruthy();
    expect(screen.getByTestId('route-error-remove')).toBeTruthy();
    expect(screen.queryByText(/Télécharger/)).toBeNull();
    mockComputeRoute.mockClear();
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(mockSources['draft-legs'].features[0].properties.mode).toBe('hand');
    expect(pointIds()).toHaveLength(2);
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
  });

  it('a first point outside the zone has no leg to relink: only "Retirer"', async () => {
    await renderScreen();
    await addPoints(OUTSIDE);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.queryByTestId('route-error-relink')).toBeNull();
    expect(screen.getByTestId('route-error-remove')).toBeTruthy();
  });

  it('"Aucun chemin trouvé" offers both ways out, the threshold from the constant', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'farFromPath' });
    await addPoints(P2);
    expect(screen.getByText('Relier ce point à la main')).toBeTruthy();
    expect(screen.getByText('Retirer ce point')).toBeTruthy();
    // The raw text: a narrow no-break space between the number and "m".
    const sentence = screen.getByText(/plus de/).props.children as string;
    expect(sentence).toContain(`plus de ${MAX_SNAP_METERS}\u202Fm d’un chemin`);
    // The text of the file holds a mark, not the number.
    expect(fr['route.farFromPathText']).toContain('{m}');
    expect(fr['route.farFromPathText']).not.toContain(String(MAX_SNAP_METERS));
  });

  it('"Retirer ce point" is an underlined link: 17, 600', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'farFromPath' });
    await addPoints(P2);
    const label = screen.getByText('Retirer ce point');
    expect(label).toHaveStyle({
      fontSize: 17,
      fontWeight: '600',
      textDecorationLine: 'underline',
    });
  });

  it('the other errors have no "Relier" button', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'noRoute' });
    await addPoints(P2);
    expect(screen.getByTestId('route-error-remove')).toBeTruthy();
    expect(screen.queryByTestId('route-error-relink')).toBeNull();
  });
});

describe('a point kept by "Relier" (T5, B1)', () => {
  const failOnP2 = (points: { lon: number }[]) =>
    Promise.resolve(
      points.some((p) => p.lon === P2[0])
        ? ({ ok: false, error: 'farFromPath' } as RouteResult)
        : success(),
    );

  it('the next point is not refused in its place; one undo restores the state', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockImplementation(failOnP2);
    await addPoints(P2);
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    // Point 3, by the paths: the leg 2 -> 3 starts at the kept point.
    await addPoints(P3);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    // The sheet is about point 2 (not drawn as a point: it is the refused one).
    expect(lngLatOf()).toEqual([P1, P3]);
    // Relink again: leg 2 -> 3 goes by hand.
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(
      mockSources['draft-legs'].features.map((f: any) => f.properties.mode),
    ).toEqual(['hand', 'hand']);
    // One undo gives back the state before the second relink.
    await fireEvent.press(screen.getByTestId('route-undo'));
    await flush();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(lngLatOf()).toEqual([P1, P3]);
    expect(
      mockSources['draft-legs'].features.map((f: any) => f.properties.mode),
    ).toEqual(['hand']);
  });
});

describe('a kept point and the other errors (T5, B2)', () => {
  const answer = (points: { lon: number }[]) =>
    Promise.resolve(
      points.some((p) => p.lon === OUTSIDE[0])
        ? ({ ok: false, error: 'outOfZone' } as RouteResult)
        : points.some((p) => p.lon === P2[0])
          ? ({ ok: false, error: 'farFromPath' } as RouteResult)
          : success(),
    );

  it('a point outside the zone after a kept point: the sheet is about the outside one', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockImplementation(answer);
    await addPoints(P2);
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    await addPoints(OUTSIDE);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    // The refused point is not drawn as a point: points 1 and 2 are.
    expect(lngLatOf()).toEqual([P1, P2]);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(lngLatOf()).toEqual([P1, P2]);
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
  });

  it('"Boucler" with a kept point: the sheet is about it, "Annuler" keeps the loop', async () => {
    await renderScreen();
    await addPoints(P1);
    mockComputeRoute.mockImplementation(answer);
    await addPoints(P2);
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    await fireEvent.press(screen.getByTestId('route-loop'));
    await flush();
    // The loop leg 2 -> 1 starts at the kept point: the sheet is about it.
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(lngLatOf()).toEqual([P1, P1]);
    // "Relier" again, then "Annuler": back to the sheet about the kept point,
    // the loop is still there (one undo = one action).
    await fireEvent.press(screen.getByTestId('route-error-relink'));
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    await fireEvent.press(screen.getByTestId('route-undo'));
    await flush();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(lngLatOf()).toEqual([P1, P1]);
  });
});

describe('hand mode (T5)', () => {
  it('the mode chosen applies to the next leg: dashed line, distance, estimated duration', async () => {
    await renderScreen();
    await addPoints(P1);
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    // Changing the mode adds nothing and moves nothing.
    expect(pointIds()).toHaveLength(1);
    await addPoints(P2);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    const [leg] = mockSources['draft-legs'].features;
    expect(leg.properties.mode).toBe('hand');
    expect(leg.geometry.coordinates).toEqual([P1, P2]);
    // About 3,7 km at 10 km/h: 22 minutes.
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      /^3,[0-9] km$/,
    );
    expect(screen.getByTestId('route-duration')).toHaveTextContent('22 min');
  });

  it('a hand leg between computed legs uses their average speed', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P3);
    await fireEvent.press(screen.getByTestId('route-mode-path'));
    await addPoints(P4);
    const modes = mockSources['draft-legs'].features.map(
      (f: any) => f.properties.mode,
    );
    expect(modes).toEqual(['path', 'hand', 'path']);
    // 2 km in 10 min = 12 km/h for the two computed legs (4 km, 20 min).
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    const handKm = handLeg(
      { id: 2, lon: P2[0], lat: P2[1] },
      { id: 3, lon: P3[0], lat: P3[1] },
    ).distanceKm;
    expect(screen.getByTestId('route-distance')).toHaveTextContent(
      formatDistance(4 + handKm),
    );
    expect(screen.getByTestId('route-duration')).toHaveTextContent(
      formatDuration(1200 + (handKm / 12) * 3600),
    );
  });
});

describe('small points left by T4', () => {
  it('a chosen start and end say so', async () => {
    await renderScreen();
    await addPoints(P1, P2);
    await pressAnnotation(1);
    expect(screen.getByLabelText('Départ, choisi')).toBeTruthy();
    await pressAnnotation(2);
    expect(screen.getByLabelText('Arrivée, choisie')).toBeTruthy();
    expect(screen.queryByLabelText('Départ, choisi')).toBeNull();
  });

  it('the bubble of the gesture names the point, from the start to the end of it', async () => {
    await renderScreen();
    await addPoints(P1, P2, P3);
    const ids = pointIds();
    await act(async () => {
      mockAnnotations[ids[1] as string].onDragStart();
    });
    expect(screen.getByText('Point 2 : relâchez pour le poser')).toBeTruthy();
    for (const lon of [6.141, 6.142, 6.143]) {
      await act(async () => {
        mockAnnotations[ids[1] as string].onDrag(event([lon, 48.69]));
      });
    }
    expect(screen.getByText('Point 2 : relâchez pour le poser')).toBeTruthy();
    await act(async () => {
      mockAnnotations[ids[1] as string].onDragEnd(event([6.15, 48.69]));
    });
    await flush();
    expect(screen.queryByText(/relâchez pour le poser/)).toBeNull();
  });
});
