// Tester's tests for T5 of phase 5 (spec C7, C8, C10, C11; ADR 0017, sections
// 3, 4, 6, 7 and 8). Written from the spec and the ADR. They complete
// RouteInfoScreen.test.tsx and DraftScreenOpenInfos.test.tsx, they do not
// repeat them.
//
// The harness stands for the nested stack of Expo Router (ADR 0017, section
// 7): the REAL DraftSession, the creation always mounted, and the Infos
// screen shown on top after `router.push('/draft/infos')`, removed after
// `router.back()`.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState, type ReactNode } from 'react';

import type { RoutePoint } from '@/core/routing/routeRequest';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';
import { DraftSession } from './DraftSession';
import { RouteInfoScreen } from './RouteInfoScreen';

// MapLibre, the router, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
let mockInfoMapProps: Record<string, unknown> = {};
const mockAnnotations: Record<string, any> = {};
let mockShowInfos: (show: boolean) => void = () => {};
const mockPush = jest.fn((_path: string) => mockShowInfos(true));
const mockBack = jest.fn(() => mockShowInfos(false));
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (
      props: Record<string, unknown> & {
        children: ReactNode;
        ref?: React.Ref<unknown>;
      },
    ) => {
      useImperativeHandle(props.ref, () => ({ showAttribution: jest.fn() }));
      // The creation map takes touches; the Infos map has no gesture.
      if (props.onPress) mockMapProps = props;
      else mockInfoMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: jest.fn() }));
      return null;
    },
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
    Layer: () => null,
    GeoJSONSource: () => null,
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    ViewAnnotation: (props: { id: string; children: ReactNode }) => {
      mockAnnotations[props.id] = props;
      return <View testID={`annotation:${props.id}`}>{props.children}</View>;
    },
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [mockNancy] }),
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

const mockNancy: ReadyMarker = {
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

type LonLat = [number, number];
const P1: LonLat = [6.1, 48.66];
const P2: LonLat = [6.14, 48.68];
const P3: LonLat = [6.18, 48.7];
const OUTSIDE: LonLat = [7.5, 48.7];

// Altitudes given one by one, 30 m apart (the resampling of ADR 0017).
function heights(...values: (number | null)[]) {
  return { ok: true, profile: values.map((h, i) => [i * 30, h]) };
}
const failed = { ok: false, error: 'failed' };
const THIRDS = {
  ok: true,
  edges: [
    { use: 'road', density: 2, lengthKm: 1 },
    { use: 'track', density: 1, lengthKm: 1 },
    { use: 'path', density: 1, lengthKm: 1 },
  ],
};

// The faked engine: the route follows the two points, 3 km, 15 min.
function routeBetween(points: RoutePoint[]) {
  return {
    ok: true,
    shape: points.map((p) => [p.lon, p.lat]),
    distanceKm: 3,
    durationS: 900,
  };
}

// Altitudes by the longitude of the start of the leg.
function heightsByStart(table: Record<number, unknown>, otherwise: unknown) {
  mockHeights.mockImplementation(async (shape: LonLat[]) => {
    const answer = table[shape[0]?.[0] as number] ?? otherwise;
    return answer;
  });
}

function Stack() {
  const [infos, setInfos] = useState(false);
  useEffect(() => {
    mockShowInfos = setInfos;
    return () => {
      mockShowInfos = () => {};
    };
  }, []);
  return (
    <>
      <DraftScreen />
      {infos ? <RouteInfoScreen /> : null}
    </>
  );
}

const clients: QueryClient[] = [];
async function renderApp() {
  const client = new QueryClient();
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <DraftSession>
        <Stack />
      </DraftSession>
    </QueryClientProvider>,
  );
  await act(async () => {});
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function settle() {
  for (let i = 0; i < 6; i++) await flush();
}

async function touchMap(at: LonLat) {
  const onPress = mockMapProps.onPress as (e: unknown) => void;
  await act(async () => {
    onPress({ nativeEvent: { lngLat: at, point: { x: 0, y: 0 } } });
    // A touch on the map waits a moment before it adds a point.
    await new Promise((resolve) => setTimeout(resolve, 130));
  });
  await settle();
}
async function addPoints(...points: LonLat[]) {
  for (const p of points) await touchMap(p);
}

const event = (at: LonLat) => ({
  nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
});
const pointIds = () =>
  screen
    .queryAllByTestId(/^annotation:/)
    .map((node) => String(node.props.testID).slice('annotation:'.length));

async function drag(n: number, to: LonLat) {
  const id = pointIds()[n - 1] as string;
  await act(async () => {
    mockAnnotations[id].onDragStart();
  });
  await act(async () => {
    mockAnnotations[id].onDragEnd(event(to));
  });
  await settle();
}

async function openInfos() {
  await fireEvent.press(screen.getByTestId('route-open-infos'));
  await flush();
}

const percents = () =>
  [...screen.getByTestId('info-legend').props.children]
    .flatMap((item: any) => item.props.children[1].props.children)
    .map((s: unknown) => String(s));

beforeEach(() => {
  jest.clearAllMocks();
  mockMapProps = {};
  mockInfoMapProps = {};
  for (const key of Object.keys(mockAnnotations)) delete mockAnnotations[key];
  mockComputeRoute.mockImplementation(async (points: RoutePoint[]) =>
    routeBetween(points),
  );
  mockHeights.mockResolvedValue(heights(100, 110, 105, 130));
  mockTerrain.mockResolvedValue(THIRDS);
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe('C7: the summary opens Infos, "Modifier" comes back', () => {
  it('opens /draft/infos once and shows Infos without "Démarrer le suivi"', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/draft/infos');
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
    expect(screen.getByTestId('info-modify')).toBeTruthy();
    expect(screen.queryByText(/Démarrer/)).toBeNull();
    expect(screen.queryByText(/suivi/i)).toBeNull();
  });

  it('"Modifier" comes back to the creation with the same points and the same D+', async () => {
    await renderApp();
    await addPoints(P1, P2);
    const ids = pointIds();
    expect(ids).toHaveLength(2);
    const ascentBefore = 35; // 100 -> 110 (+10), 105 -> 130 (+25), threshold 5 m
    expect(screen.getByTestId('route-ascent')).toHaveTextContent(
      `${ascentBefore} m`,
    );
    await openInfos();
    await fireEvent.press(screen.getByRole('button', { name: /Modifier/ }));
    await flush();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('info-distance')).toBeNull();
    expect(pointIds()).toEqual(ids);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('35 m');
    expect(screen.getByTestId('route-distance')).toHaveTextContent('3,0 km');
    // The draft can still be edited: a third point is added to it.
    await addPoints(P3);
    expect(pointIds()).toHaveLength(3);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('6,0 km');
  });

  it('opening Infos and coming back computes nothing', async () => {
    await renderApp();
    await addPoints(P1, P2);
    const calls = () => [
      mockComputeRoute.mock.calls.length,
      mockHeights.mock.calls.length,
      mockTerrain.mock.calls.length,
    ];
    const before = calls();
    await openInfos();
    await settle();
    expect(calls()).toEqual(before);
    await fireEvent.press(screen.getByTestId('info-modify'));
    await settle();
    expect(calls()).toEqual(before);
  });

  it('is not touchable with 0 or 1 point, becomes touchable with the 2nd', async () => {
    await renderApp();
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    await addPoints(P1);
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    await addPoints(P2);
    expect(screen.getByTestId('route-open-infos')).toBeTruthy();
    // Back to one point: not touchable again.
    await fireEvent.press(screen.getByTestId('route-undo'));
    await settle();
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('is not touchable while a 3rd point is computed, touchable again once done', async () => {
    let release: (value: unknown) => void = () => {};
    await renderApp();
    await addPoints(P1, P2);
    mockHeights.mockImplementation((shape: LonLat[]) =>
      shape[0]?.[0] === P2[0]
        ? new Promise((resolve) => (release = resolve))
        : Promise.resolve(heights(100, 110)),
    );
    await addPoints(P3);
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    await act(async () => {
      release(heights(110, 120));
    });
    await settle();
    expect(screen.getByTestId('route-open-infos')).toBeTruthy();
  });

  it('is not touchable with an error sheet, touchable again once the point is removed', async () => {
    await renderApp();
    await addPoints(P1, P2);
    mockComputeRoute.mockImplementation(async (points: RoutePoint[]) =>
      points[1]?.lon === P3[0]
        ? { ok: false, error: 'noRoute' }
        : routeBetween(points),
    );
    await addPoints(P3);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    await settle();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.getByTestId('route-open-infos')).toBeTruthy();
  });
});

describe('C7 and C8: "Difficulté" line of a zone without table (phase 5b)', () => {
  const unknownText = 'Difficulté inconnue, la carte la donne rarement.';
  async function expectUnknownDifficulty() {
    expect(screen.getByTestId('info-distance')).toBeTruthy();
    expect(screen.getByText(unknownText)).toBeTruthy();
  }

  it('says unknown with complete data', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    await expectUnknownDifficulty();
  });

  it('says unavailable when altitudes and terrain are missing', async () => {
    mockHeights.mockResolvedValue(failed);
    mockTerrain.mockResolvedValue(failed);
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(screen.getByTestId('info-distance')).toBeTruthy();
    expect(screen.getByText('Difficulté indisponible')).toBeTruthy();
  });

  it('says unknown with a hand leg', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P3);
    await openInfos();
    await expectUnknownDifficulty();
  });
});

describe('C8: altitudes, joined profile, terrain shares', () => {
  it('shows a general case: 312, 305, 341, 298, 330 m give D+ 68, D- 50, from 298 to 341 m', async () => {
    // By hand, with the rule of ADR 0017, section 4 (threshold 5 m, the
    // reference moves only on a change of 5 m or more):
    //   D+ : ref 312; 305 is -7 (ref 305); 341 is +36 (D+ 36, ref 341);
    //        298 is -43 (ref 298); 330 is +32 (D+ 68).
    //   D- : same on the opposite sign: 305 gives 7, 341 none, 298 gives 43
    //        (7 + 43 = 50), 330 none.
    mockHeights.mockResolvedValue(heights(312, 305, 341, 298, 330));
    await renderApp();
    await addPoints(P1, P2);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('68 m');
    await openInfos();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('68 m');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('50 m');
    expect(screen.getByTestId('info-range')).toHaveTextContent(
      'de 298 à 341 m',
    );
    expect(screen.getByTestId('info-profile').props.accessibilityLabel).toBe(
      "Profil d'altitude, de 298 à 341\u202Fm",
    );
  });

  it('joins the profiles of the legs before the threshold: 3 m + 3 m make 6 m of ascent', async () => {
    // ADR 0017, section 4: leg 1 climbs 100 -> 103, leg 2 climbs 103 -> 106.
    // Joined, 106 - 100 = 6 m (>= 5): counted. Added leg by leg: 0 m.
    heightsByStart(
      { [P1[0]]: heights(100, 103), [P2[0]]: heights(103, 106) },
      {},
    );
    await renderApp();
    await addPoints(P1, P2, P3);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('6 m');
    await openInfos();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('6 m');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('0 m');
    expect(screen.getByTestId('info-distance')).toHaveTextContent('6,0 km');
    expect(screen.getByTestId('info-range')).toHaveTextContent(
      'de 100 à 106 m',
    );
  });

  it('joins the descents the same way: 106 -> 103 -> 100 make 6 m of descent', async () => {
    heightsByStart(
      { [P1[0]]: heights(106, 103), [P2[0]]: heights(103, 100) },
      {},
    );
    await renderApp();
    await addPoints(P1, P2, P3);
    await openInfos();
    expect(screen.getByTestId('info-descent')).toHaveTextContent('6 m');
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('0 m');
  });

  it('rounds three equal thirds to 34, 33 and 33 (largest remainder, ties: road, track, trail)', async () => {
    // ADR 0017, section 3: 33.33 each, so the missing point goes to the first
    // in the order road, track, trail, hand.
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(screen.getByText('Route 34 %')).toBeTruthy();
    expect(screen.getByText('Piste 33 %')).toBeTruthy();
    expect(screen.getByText('Sentier 33 %')).toBeTruthy();
    expect(screen.queryByText(/À la main \d/)).toBeNull();
  });

  it('shares make 100 % with a hand leg, which adds a 4th share', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P3);
    await openInfos();
    const shares = percents();
    expect(shares).toHaveLength(4);
    expect(shares.some((s) => /^À la main/.test(s))).toBe(true);
    const sum = shares
      .map((s) => Number(/(\d+)\s/.exec(s.replace(/ /g, ' '))?.[1]))
      .reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('a route made only by hand shows 0 % for road, track and trail and 100 % by hand', async () => {
    await renderApp();
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(P1, P2);
    await openInfos();
    expect(mockTerrain).not.toHaveBeenCalled();
    expect(screen.getByText('Route 0 %')).toBeTruthy();
    expect(screen.getByText('Piste 0 %')).toBeTruthy();
    expect(screen.getByText('Sentier 0 %')).toBeTruthy();
    expect(screen.getByText('À la main 100 %')).toBeTruthy();
    expect(screen.getByTestId('info-band-hand')).toBeTruthy();
  });
});

describe('C10: missing data, never a crash', () => {
  it('altitudes of one leg out of two missing: nothing partial, the dash in the summary', async () => {
    heightsByStart({ [P2[0]]: failed }, heights(100, 120));
    await renderApp();
    await addPoints(P1, P2, P3);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
    await openInfos();
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    // p05-t8 C6: the four cells stay, with a dash; the title stays.
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('—');
    expect(screen.getByText('Profil et terrain')).toBeTruthy();
    expect(screen.queryByTestId('info-profile')).toBeNull();
    expect(screen.queryByTestId('info-range')).toBeNull();
    expect(screen.getByTestId('info-distance')).toHaveTextContent('6,0 km');
    expect(screen.getByTestId('info-duration')).toHaveTextContent('30 min');
    expect(screen.getByTestId('info-map')).toBeTruthy();
    expect(screen.getByTestId('info-legend')).toBeTruthy();
  });

  it('a null altitude inside a profile makes the altitudes missing', async () => {
    mockHeights.mockResolvedValue(heights(100, null, 120));
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    // p05-t8 C6: the cell stays, with a dash.
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('info-distance')).toBeTruthy();
  });

  it('an engine that rejects does not crash the creation nor Infos', async () => {
    mockHeights.mockRejectedValue(new Error('boom'));
    mockTerrain.mockRejectedValue(new Error('boom'));
    await renderApp();
    await addPoints(P1, P2);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');
    await openInfos();
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect(screen.getByText('Terrain indisponible')).toBeTruthy();
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
  });

  it('an empty profile is reported as missing', async () => {
    mockHeights.mockResolvedValue({ ok: true, profile: [] });
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect(screen.getByTestId('info-distance')).toBeTruthy();
  });

  it('a one-altitude profile does not crash', async () => {
    mockHeights.mockResolvedValue(heights(100));
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
    expect(screen.getByTestId('info-map')).toBeTruthy();
  });

  it('the terrain of one leg out of two missing: "Terrain indisponible", altitudes kept', async () => {
    mockTerrain.mockImplementation(async (shape: LonLat[]) =>
      shape[0]?.[0] === P2[0] ? failed : THIRDS,
    );
    await renderApp();
    await addPoints(P1, P2, P3);
    await openInfos();
    expect(screen.getByText('Terrain indisponible')).toBeTruthy();
    expect(screen.queryByTestId('info-legend')).toBeNull();
    expect(screen.queryByTestId('info-band-road')).toBeNull();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('70 m');
    expect(screen.getByTestId('info-profile')).toBeTruthy();
    expect(screen.getByTestId('info-distance')).toHaveTextContent('6,0 km');
  });

  it('a terrain without any length (null base) is "Terrain indisponible"', async () => {
    mockTerrain.mockResolvedValue({ ok: true, edges: [] });
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(screen.getByText('Terrain indisponible')).toBeTruthy();
    expect(screen.queryByTestId('info-legend')).toBeNull();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('35 m');
  });

  it('altitudes and terrain both missing: both said, distance, duration and map stay', async () => {
    mockHeights.mockResolvedValue(failed);
    mockTerrain.mockResolvedValue(failed);
    await renderApp();
    await addPoints(P1, P2);
    await openInfos();
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect(screen.getByText('Terrain indisponible')).toBeTruthy();
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
    expect(screen.getByTestId('info-duration')).toHaveTextContent('15 min');
    expect(screen.getByTestId('info-map')).toBeTruthy();
    expect(mockInfoMapProps.dragPan).toBe(false);
    expect(screen.getByTestId('info-modify')).toBeTruthy();
  });

  it('a hand leg ending outside the zone: no altitude call for it, altitudes missing, no crash', async () => {
    await renderApp();
    await addPoints(P1, P2);
    mockHeights.mockClear();
    await fireEvent.press(screen.getByTestId('route-mode-hand'));
    await addPoints(OUTSIDE);
    expect(mockHeights).not.toHaveBeenCalled();
    await openInfos();
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect(screen.getByTestId('info-distance')).toBeTruthy();
    expect(screen.getByTestId('info-map')).toBeTruthy();
  });

  it('a pending request shows "…" and keeps distance, duration and map', async () => {
    mockHeights.mockReturnValue(new Promise(() => {}));
    mockTerrain.mockReturnValue(new Promise(() => {}));
    await renderApp();
    await touchMap(P1);
    await touchMap(P2);
    // The summary waits for the altitudes: it is not touchable yet, so the
    // Infos screen is opened by the router (deep link, back stack).
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    await act(async () => mockShowInfos(true));
    await settle();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('…');
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
    expect(screen.getByTestId('info-map')).toBeTruthy();
  });
});

describe('Infos makes no native call, even after a failed calculation', () => {
  it('opening Infos, then "Modifier", does not ask again for failed altitudes and terrain', async () => {
    mockHeights.mockResolvedValue(failed);
    mockTerrain.mockResolvedValue(failed);
    await renderApp();
    await addPoints(P1, P2);
    const before = [
      mockComputeRoute.mock.calls.length,
      mockHeights.mock.calls.length,
      mockTerrain.mock.calls.length,
    ];
    expect(before).toEqual([1, 1, 1]);
    await openInfos();
    await settle();
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect([
      mockComputeRoute.mock.calls.length,
      mockHeights.mock.calls.length,
      mockTerrain.mock.calls.length,
    ]).toEqual(before);
    await fireEvent.press(screen.getByTestId('info-modify'));
    await settle();
    expect([
      mockComputeRoute.mock.calls.length,
      mockHeights.mock.calls.length,
      mockTerrain.mock.calls.length,
    ]).toEqual(before);
  });
});

describe('The creation computes a failure again (ADR 0017, section 6)', () => {
  it('A to B fails, B is moved, "Annuler": A to B is computed again and its D+ shows', async () => {
    // The first altitude request of the leg A -> B fails; every other one
    // (A -> P3, then A -> B again) is answered.
    let abAttempts = 0;
    mockHeights.mockImplementation(async (shape: LonLat[]) => {
      const last = shape[shape.length - 1] as LonLat;
      if (last[0] === P2[0]) {
        abAttempts += 1;
        if (abAttempts === 1) return failed;
        return heights(200, 230);
      }
      return heights(200, 215);
    });
    await renderApp();
    await addPoints(P1, P2);
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('—');

    await drag(2, P3);
    expect(mockHeights).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('15 m');

    await fireEvent.press(screen.getByTestId('route-undo'));
    await settle();
    expect(abAttempts).toBe(2);
    expect(mockHeights).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('route-ascent')).toHaveTextContent('30 m');
    // What had succeeded is not asked again.
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(mockTerrain).toHaveBeenCalledTimes(2);
    await openInfos();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('30 m');
  });
});
