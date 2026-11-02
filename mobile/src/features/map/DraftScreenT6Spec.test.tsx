// Tester's tests for T6 of phase 5 (spec C14; ADR 0017, sections 7 and 10;
// design/comparaisons/p04-t7.md, A1, A2, A3; mockups 10 and 11). Written from
// the spec, the mockups and the tokens. They complete DraftScreenT6.test.tsx.
//
// Note: the text matchers of Testing Library collapse U+00A0 and U+202F into
// plain spaces. These tests read the raw strings, to check the exact signs.
//
// The harness stands for the nested stack of Expo Router (ADR 0017, section
// 7): the REAL DraftSession, the creation always mounted, Infos on top.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { RoutePoint } from '@/core/routing/routeRequest';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';
import { DraftSession } from './DraftSession';
import { RouteInfoScreen } from './RouteInfoScreen';

let mockMapProps: Record<string, unknown> = {};
const mockAnnotations: Record<string, any> = {};
const mockMounts: Record<string, number> = {};
let mockShowInfos: (show: boolean) => void = () => {};
const mockPush = jest.fn((_path: string) => mockShowInfos(true));
const mockBack = jest.fn(() => mockShowInfos(false));
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle, useEffect: useEffectMock } =
    jest.requireActual('react');
  return {
    Map: (
      props: Record<string, unknown> & {
        children: ReactNode;
        ref?: React.Ref<unknown>;
      },
    ) => {
      useImperativeHandle(props.ref, () => ({ showAttribution: jest.fn() }));
      if (props.onPress) mockMapProps = props;
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
      // Runs once per mount: a new React key shows as a new mount.
      useEffectMock(() => {
        mockMounts[props.id] = (mockMounts[props.id] ?? 0) + 1;
      }, []);
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

const NBSP = ' ';
const NNBSP = ' ';

function routeBetween(points: RoutePoint[]) {
  return {
    ok: true,
    shape: points.map((p) => [p.lon, p.lat]),
    distanceKm: 3,
    durationS: 900,
  };
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

async function chooseMode(mode: 'hand' | 'path') {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`route-mode-${mode}`));
  });
}
async function touchPoint(n: number) {
  await act(async () => {
    mockAnnotations[pointIds()[n - 1] as string].onPress();
  });
  // A touch on a point blocks the map for 300 ms.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320));
  });
}

type TNode = ReturnType<typeof screen.getByTestId>;
function rawText(node: TNode): string {
  return node.children
    .map((c) => (typeof c === 'string' ? c : rawText(c as TNode)))
    .join('');
}

const sizeOf = (node: { props: { style?: unknown } }) => {
  const style = StyleSheet.flatten(node.props.style as never) as {
    width: number;
    height: number;
  };
  return [style.width, style.height];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMapProps = {};
  for (const key of Object.keys(mockAnnotations)) delete mockAnnotations[key];
  for (const key of Object.keys(mockMounts)) delete mockMounts[key];
  mockComputeRoute.mockImplementation(async (points: RoutePoint[]) =>
    routeBetween(points),
  );
  mockHeights.mockResolvedValue({
    ok: true,
    profile: [
      [0, 100],
      [30, 130],
    ],
  });
  mockTerrain.mockResolvedValue({
    ok: true,
    edges: [{ use: 'track', density: 0, lengthKm: 3 }],
  });
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe('A1: the key of the annotation during a drag', () => {
  async function dragAll(id: string) {
    await act(async () => {
      mockAnnotations[id].onDragStart();
    });
    for (const to of [P2, [6.15, 48.69], [6.16, 48.7]] as LonLat[]) {
      await act(async () => {
        mockAnnotations[id].onDrag(event(to));
      });
    }
  }

  it('a chosen point is not mounted again from onDragStart to onDrag', async () => {
    await renderApp();
    await addPoints(P1, P2, P3);
    await touchPoint(2);
    const id = pointIds()[1] as string;
    const node = screen.getByTestId(`annotation:${id}`);
    const mounts = { ...mockMounts };
    await dragAll(id);
    expect(mockMounts).toEqual(mounts);
    expect(screen.getByTestId(`annotation:${id}`)).toBe(node);
    expect(screen.getByTestId('draft-marker-halo')).toBeTruthy();
  });

  it('a point that is not chosen is not mounted again either, and stays 28', async () => {
    await renderApp();
    await addPoints(P1, P2, P3);
    const id = pointIds()[1] as string;
    const mounts = { ...mockMounts };
    await dragAll(id);
    expect(mockMounts).toEqual(mounts);
    expect(sizeOf(screen.getByText('2').parent as never)).toEqual([28, 28]);
    expect(screen.queryByTestId('draft-marker-halo')).toBeNull();
  });

  it('at the end of the drag the point is still one annotation, never two', async () => {
    await renderApp();
    await addPoints(P1, P2, P3);
    const id = pointIds()[1] as string;
    await dragAll(id);
    await act(async () => {
      mockAnnotations[id].onDragEnd(event([6.16, 48.7]));
    });
    await settle();
    expect(pointIds()).toHaveLength(3);
  });
});

describe('A1: size and look of the chosen point (ADR 0017, section 10)', () => {
  it('the chosen middle point: round 40, digit 18, halo magenta 22 %, shadow 0 6 12 at 35 %', async () => {
    await renderApp();
    await addPoints(P1, P2, P3);
    await touchPoint(2);
    const digit = screen.getByText('2');
    expect(sizeOf(digit.parent as never)).toEqual([40, 40]);
    expect(StyleSheet.flatten(digit.props.style).fontSize).toBe(18);
    const round = StyleSheet.flatten(digit.parent?.props.style);
    expect(round.shadowOffset).toEqual({ width: 0, height: 6 });
    expect(round.shadowRadius).toBe(12);
    expect(round.shadowOpacity).toBeCloseTo(0.35, 2);
    const halo = StyleSheet.flatten(
      screen.getByTestId('draft-marker-halo').props.style,
    );
    expect([halo.width, halo.height]).toEqual([56, 56]);
    expect(halo.borderRadius).toBe(28);
    expect(halo.backgroundColor).toBe('rgba(194, 0, 122, 0.22)');
  });

  it('letting the point go brings the round back to 28, without halo', async () => {
    await renderApp();
    await addPoints(P1, P2, P3);
    await touchPoint(2);
    await touchPoint(2);
    expect(screen.queryByTestId('draft-marker-halo')).toBeNull();
    expect(sizeOf(screen.getByText('2').parent as never)).toEqual([28, 28]);
  });
});

describe('A2: help bubble of the hand mode', () => {
  const lead = () => screen.getByTestId('route-hand-help');
  const HELP = `À la main${NBSP}: chaque touche ajoute un point, relié au précédent en ligne droite.`;

  it('has the exact text, with a no-break space before the colon', async () => {
    await renderApp();
    await chooseMode('hand');
    expect(rawText(lead())).toContain(HELP);
    expect(HELP).toContain(`main${NBSP}:`);
  });

  it('shows at once on entering the mode, before any point', async () => {
    await renderApp();
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
    await chooseMode('hand');
    expect(screen.getByTestId('route-hand-help')).toBeTruthy();
  });

  it('stays while nothing is touched (choosing the mode twice does not hide it)', async () => {
    await renderApp();
    await chooseMode('hand');
    await chooseMode('hand');
    expect(screen.getByTestId('route-hand-help')).toBeTruthy();
  });

  it('does not come back when the hand mode is chosen again without leaving it', async () => {
    await renderApp();
    await chooseMode('hand');
    await touchMap(P1);
    await chooseMode('hand');
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
  });

  it('goes at the first touch on the map', async () => {
    await renderApp();
    await chooseMode('hand');
    await touchMap(P1);
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
  });

  it('goes at the first touch on a point', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await chooseMode('hand');
    expect(screen.getByTestId('route-hand-help')).toBeTruthy();
    await act(async () => {
      mockAnnotations[pointIds()[0] as string].onPress();
    });
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
  });

  it('comes back at each new passage in the mode, again and again', async () => {
    await renderApp();
    for (let round = 0; round < 3; round++) {
      await chooseMode('hand');
      expect(screen.getByTestId('route-hand-help')).toBeTruthy();
      await touchMap(round % 2 ? P2 : P1);
      expect(screen.queryByTestId('route-hand-help')).toBeNull();
      await chooseMode('path');
      expect(screen.queryByTestId('route-hand-help')).toBeNull();
    }
  });

  it('does not come back after "Infos" then "Modifier"', async () => {
    await renderApp();
    await chooseMode('hand');
    await addPoints(P1, P2);
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
    await fireEvent.press(screen.getByTestId('route-open-infos'));
    await flush();
    expect(screen.getByTestId('info-modify')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('info-modify'));
    await flush();
    expect(screen.queryByTestId('info-distance')).toBeNull();
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
  });

  it('does not show in the path mode after "Infos" then "Modifier"', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await fireEvent.press(screen.getByTestId('route-open-infos'));
    await flush();
    await fireEvent.press(screen.getByTestId('info-modify'));
    await flush();
    expect(screen.queryByTestId('route-hand-help')).toBeNull();
  });
});

describe('A3: note about the hand legs', () => {
  const note = () => screen.getByTestId('route-hand-note');
  // Source outside the code: haversine on a sphere of 6371 km. 0.04 deg of
  // longitude at 48.67 deg north = 2.938 km, 0.02 deg of latitude = 2.224 km:
  // sqrt(2.938^2 + 2.224^2) = 3.685 km, written "3,7 km".
  const HAND = `À la main${NBSP}: 3,7${NNBSP}km`;

  function noteText() {
    const text = note().children.find(
      (c) => typeof c !== 'string' && (c as TNode).type === 'Text',
    ) as TNode;
    return rawText(text);
  }

  it('is absent without a hand leg, even with path legs', async () => {
    await renderApp();
    await addPoints(P1, P2, P3);
    expect(screen.queryByTestId('route-hand-note')).toBeNull();
  });

  it('is absent with one point only in the hand mode', async () => {
    await renderApp();
    await chooseMode('hand');
    await addPoints(P1);
    expect(screen.queryByTestId('route-hand-note')).toBeNull();
  });

  it('is present with a hand leg, with the exact signs (U+00A0, U+202F)', async () => {
    await renderApp();
    await chooseMode('hand');
    await addPoints(P1, P2);
    expect(noteText()).toBe(HAND);
  });

  it('counts the hand part only in a mixed route, not the total', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await chooseMode('hand');
    await addPoints(P3);
    // Path leg 3 km (faked engine) + hand leg P2-P3 (3.7 km): total 6,7 km.
    expect(rawText(screen.getByTestId('route-distance'))).toBe(`6,7${NNBSP}km`);
    expect(noteText()).toBe(HAND);
  });

  it('goes after "Annuler" removes the only hand leg', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await chooseMode('hand');
    await addPoints(P3);
    expect(noteText()).toBe(HAND);
    await fireEvent.press(screen.getByTestId('route-undo'));
    await settle();
    expect(screen.queryByTestId('route-hand-note')).toBeNull();
  });

  it('is updated after "Annuler" removes one of two hand legs', async () => {
    await renderApp();
    await chooseMode('hand');
    // P1-P2 = 3.7 km; P2-[6.14, 48.6845] = 500 m ... then undo it.
    await addPoints(P1, P2, [6.14, 48.6845]);
    await fireEvent.press(screen.getByTestId('route-undo'));
    await settle();
    expect(noteText()).toBe(HAND);
  });

  it('goes after the deletion of the point that ends the hand leg', async () => {
    await renderApp();
    await addPoints(P1, P2);
    await chooseMode('hand');
    await addPoints(P3);
    expect(noteText()).toBe(HAND);
    await touchPoint(3);
    await fireEvent.press(screen.getByTestId('route-delete'));
    await settle();
    expect(pointIds()).toHaveLength(2);
    expect(screen.queryByTestId('route-hand-note')).toBeNull();
  });

  it('shows meters under a kilometer, with a no-break space before the unit', async () => {
    await renderApp();
    await chooseMode('hand');
    // 0.0045 deg of latitude = 500.4 m
    await addPoints(P1, [6.1, 48.6645]);
    const text = noteText();
    expect(text.startsWith(`À la main${NBSP}: 500`)).toBe(true);
    expect(text).toMatch(/500[  ]m$/);
  });
});
