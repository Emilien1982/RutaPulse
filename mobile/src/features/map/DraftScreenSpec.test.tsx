// Tests of the creation screen written from the spec of phase 4
// (docs/phases/p04-creer-modifier-itineraire.md: C1, C2, C4, C5, C6, C10, C12)
// and from the decisions of T4. MapLibre, the router and the engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, StyleSheet } from 'react-native';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';
import { mapColors } from '@/ui/theme';

import { DraftScreen } from './DraftScreen';

let mockMapProps: Record<string, unknown> = {};
const mockSources: Record<string, any> = {};
const mockAnnotations: Record<string, any> = {};
const mockComputeRoute = jest.fn();
const mockBack = jest.fn();
const mockRepeat = jest.fn();
let mockPrevent: { value: boolean; callback: (o: any) => void } | undefined;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: jest.fn() }));
      return null;
    },
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
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
    Promise.resolve({ granted: false, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: (value: boolean, callback: (o: any) => void) => {
    mockPrevent = { value, callback };
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [nancy] }),
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

// Node modules, without type definitions in this project.
const fs = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
  existsSync(path: string): boolean;
};

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

type LonLat = [number, number];
type Pt = { lon: number; lat: number };
const A: LonLat = [6.1, 48.66];
const B: LonLat = [6.14, 48.68];
const C: LonLat = [6.18, 48.7];
const D: LonLat = [6.2, 48.72];
const E: LonLat = [6.22, 48.74];
const OUTSIDE: LonLat = [7.5, 48.7];

// Narrow no-break space (U+202F) before the unit: gap M1 of p03-t6.md.
const NNBSP = ' ';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const same = (p: LonLat, q: LonLat) => near(p[0], q[0]) && near(p[1], q[1]);

// A fake engine whose answer depends on the two points of the leg: the
// expected figures of each test are the sums written by hand in the test.
type Figures = { km: number; s: number };
function engineWith(figures: [LonLat, LonLat, Figures][], fallback: Figures) {
  mockComputeRoute.mockImplementation(
    async (points: { lon: number; lat: number }[]): Promise<RouteResult> => {
      const [p, q] = points as [Pt, Pt];
      const found = figures.find(
        ([from, to]) => same(from, [p.lon, p.lat]) && same(to, [q.lon, q.lat]),
      );
      const f = found ? found[2] : fallback;
      return {
        ok: true,
        shape: [
          [p.lon, p.lat],
          [q.lon, q.lat],
        ],
        distanceKm: f.km,
        durationS: f.s,
      };
    },
  );
}

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftScreen />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const press = (at: LonLat) =>
  (mockMapProps.onPress as (e: unknown) => void)({
    nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
  });
const event = (at: LonLat) => ({
  nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
});

async function touchMap(at: LonLat) {
  await act(async () => {
    press(at);
    await new Promise((resolve) => setTimeout(resolve, 130));
  });
  await flush();
}
async function addPoints(...points: LonLat[]) {
  for (const p of points) await touchMap(p);
}

function pointIds() {
  return screen
    .queryAllByTestId(/^annotation:/)
    .map((node) => String(node.props.testID).slice('annotation:'.length));
}
// Positions of the points on screen, in order.
function positions(): LonLat[] {
  return pointIds().map((id) => mockAnnotations[id].lngLat as LonLat);
}
async function choose(n: number) {
  await act(async () => {
    mockAnnotations[pointIds()[n - 1] as string].onPress();
  });
  // A touch on a point blocks the map for 300 ms.
  await wait(320);
}
async function pressTool(id: 'route-delete' | 'route-undo' | 'route-loop') {
  await fireEvent.press(screen.getByTestId(id));
  await flush();
}

type Node = ReturnType<typeof screen.getByTestId>;
function textOf(node: Node): string {
  return node.children
    .map((c) => (typeof c === 'string' ? c : textOf(c as Node)))
    .join('');
}
const distance = () => textOf(screen.getByTestId('route-distance'));
const duration = () => textOf(screen.getByTestId('route-duration'));

async function dragStart(n: number) {
  await act(async () => {
    mockAnnotations[pointIds()[n - 1] as string].onDragStart();
  });
}
async function dragEnd(n: number, at: LonLat) {
  const id = pointIds()[n - 1] as string;
  await act(async () => {
    mockAnnotations[id].onDragEnd(event(at));
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockComputeRoute.mockReset();
  mockPrevent = undefined;
  for (const o of [mockSources, mockAnnotations]) {
    for (const key of Object.keys(o)) delete o[key];
  }
  engineWith([], { km: 2, s: 600 });
});

describe('C1: full screen, no tab bar, the cross and the confirmation', () => {
  it('is a route of the root stack, outside (tabs), as a full screen modal', () => {
    const app = `${process.cwd()}/src/app`;
    expect(fs.existsSync(`${app}/draft.tsx`)).toBe(true);
    expect(fs.existsSync(`${app}/(tabs)/draft.tsx`)).toBe(false);
    const layout = fs.readFileSync(`${app}/_layout.tsx`, 'utf8');
    expect(layout).toMatch(/name="draft"/);
    expect(layout).toMatch(/presentation: 'fullScreenModal'/);
    expect(layout).toMatch(/gestureEnabled: false/);
  });

  it('draws no tab bar of its own', async () => {
    await renderScreen();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it.each([0, 1])(
    'the cross closes at once with %i point(s): no dialog, nothing blocked',
    async (count) => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      await renderScreen();
      await addPoints(...[A].slice(0, count));
      expect(mockPrevent?.value).toBe(false);
      await fireEvent.press(screen.getByTestId('route-close'));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(alert).not.toHaveBeenCalled();
      alert.mockRestore();
    },
  );

  it('from 2 points, the way out (cross and Android back) is blocked and a native dialog asks', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    await addPoints(A, B);
    // `usePreventRemove(true)` is what blocks the back button of Android too.
    expect(mockPrevent?.value).toBe(true);
    mockPrevent?.callback({ data: { action: {} }, repeat: mockRepeat });
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alert.mock.calls[0] as [
      string,
      string,
      { text: string; style?: string; onPress?: () => void }[],
    ];
    // p04-t7 M3: narrow no-break space (U+202F) before the "?".
    expect(title).toBe('Abandonner cet itinéraire\u202F?');
    expect(buttons.map((b) => b.text)).toEqual(['Continuer', 'Abandonner']);
    expect(buttons[0]?.style).toBe('cancel');
    // Continuer: nothing leaves.
    buttons[0]?.onPress?.();
    expect(mockRepeat).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    // Abandonner: the blocked action is repeated.
    await act(async () => buttons[1]?.onPress?.());
    expect(mockRepeat).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('the block follows the number of points: lifted when "Annuler" goes under 2', async () => {
    await renderScreen();
    await addPoints(A, B);
    expect(mockPrevent?.value).toBe(true);
    await pressTool('route-undo');
    expect(mockPrevent?.value).toBe(false);
  });
});

describe('C2: adding', () => {
  it('a touch adds one point at the end and starts one calculation', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    expect(positions()).toEqual([A, B, C]);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    mockComputeRoute.mockClear();
    await touchMap(D);
    expect(positions()).toEqual([A, B, C, D]);
    // Only the new leg: C -> D.
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    const sent = mockComputeRoute.mock.calls[0]?.[0] as {
      lon: number;
      lat: number;
    }[];
    expect(sent.map((p) => [p.lon, p.lat])).toEqual([C, D]);
  });

  it('two quick touches (40 ms apart) give 2 points', async () => {
    await renderScreen();
    await act(async () => {
      press(A);
      await new Promise((resolve) => setTimeout(resolve, 40));
      press(B);
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    await flush();
    expect(positions()).toEqual([A, B]);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
  });

  it('the point only appears after the 120 ms guard against the phantom touch of iOS', async () => {
    await renderScreen();
    await act(async () => {
      press(A);
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(pointIds()).toHaveLength(0);
    await wait(120);
    expect(pointIds()).toHaveLength(1);
  });

  it('a touch on a point cancels the add that the same touch started on the map', async () => {
    await renderScreen();
    await addPoints(A, B);
    await act(async () => {
      press(B);
      mockAnnotations[pointIds()[1] as string].onPress();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(pointIds()).toHaveLength(2);
  });

  it('a touch on the map is ignored during a drag, and works again after it', async () => {
    await renderScreen();
    await addPoints(A, B);
    await dragStart(2);
    await act(async () => {
      press(C);
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(pointIds()).toHaveLength(2);
    await dragEnd(2, B);
    await wait(350);
    await touchMap(C);
    expect(pointIds()).toHaveLength(3);
  });

  it('start is green, the arrival has its own marker, the others are numbered', async () => {
    await renderScreen();
    await addPoints(A, B, C, D);
    expect(mapColors.start).toMatch(/^#/);
    // Green: the green channel is the strongest.
    const [r, g, b] = [1, 3, 5].map((i) =>
      parseInt(mapColors.start.slice(i, i + 2), 16),
    );
    expect((g as number) > (r as number) && (g as number) > (b as number)).toBe(
      true,
    );
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
    expect(screen.getByLabelText('Point 2')).toBeTruthy();
    expect(screen.getByLabelText('Point 3')).toBeTruthy();
    expect(textOf(screen.getByLabelText('Point 2'))).toBe('2');
    expect(textOf(screen.getByLabelText('Point 3'))).toBe('3');
    // No number on the start nor the arrival.
    expect(textOf(screen.getByLabelText('Départ'))).toBe('');
    expect(textOf(screen.getByLabelText('Arrivée'))).toBe('');
  });
});

describe('choosing a point', () => {
  it('shows the bubble "Maintenez le point, puis glissez-le" while a point is chosen', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    expect(
      screen.queryByText('Maintenez le point, puis glissez-le'),
    ).toBeNull();
    await choose(2);
    expect(
      screen.getByText('Maintenez le point, puis glissez-le'),
    ).toBeTruthy();
  });

  it('touching the chosen point again lets it go: bubble gone, Supprimer greyed', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    await choose(2);
    expect(screen.getByTestId('route-delete')).toBeEnabled();
    await choose(2);
    expect(
      screen.queryByText('Maintenez le point, puis glissez-le'),
    ).toBeNull();
    expect(screen.getByTestId('route-delete')).toBeDisabled();
  });

  it('touching another point moves the choice', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    await choose(2);
    await choose(3);
    expect(screen.queryByLabelText('Point 2, choisi')).toBeNull();
    expect(screen.getByLabelText('Point 2')).toBeTruthy();
    // One halo only, on the new choice.
    expect(screen.getAllByTestId('draft-marker-halo')).toHaveLength(1);
    expect(screen.getByTestId('route-delete')).toBeEnabled();
  });

  it('a touch on the map right after a touch on a point adds nothing (300 ms)', async () => {
    await renderScreen();
    await addPoints(A, B);
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onPress();
      press(C);
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(pointIds()).toHaveLength(2);
  });
});

describe('C4: deleting', () => {
  it('Supprimer is greyed until a point is chosen', async () => {
    await renderScreen();
    await addPoints(A, B);
    expect(screen.getByTestId('route-delete')).toBeDisabled();
    await choose(1);
    expect(screen.getByTestId('route-delete')).toBeEnabled();
  });

  it('removing a middle point joins its neighbours by one recalculated leg and renumbers', async () => {
    await renderScreen();
    await addPoints(A, B, C, D, E);
    expect(screen.getByLabelText('Point 4')).toBeTruthy();
    await choose(3); // Point 3 = C
    mockComputeRoute.mockClear();
    await pressTool('route-delete');
    expect(positions()).toEqual([A, B, D, E]);
    // One new leg: B -> D.
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    const sent = mockComputeRoute.mock.calls[0]?.[0] as {
      lon: number;
      lat: number;
    }[];
    expect(sent.map((p) => [p.lon, p.lat])).toEqual([B, D]);
    // Numbers: Départ, 2, 3, Arrivée. "Point 4" is gone.
    expect(screen.queryByLabelText('Point 4')).toBeNull();
    expect(textOf(screen.getByLabelText('Point 2'))).toBe('2');
    expect(textOf(screen.getByLabelText('Point 3'))).toBe('3');
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
    // The choice is gone with the point.
    expect(screen.getByTestId('route-delete')).toBeDisabled();
  });

  it('removing the start: the second point becomes the start, no calculation, shorter figures', async () => {
    engineWith(
      [
        [A, B, { km: 2, s: 600 }],
        [B, C, { km: 1.5, s: 300 }],
      ],
      { km: 9, s: 9 },
    );
    await renderScreen();
    await addPoints(A, B, C);
    expect(distance()).toBe(`3,5${NNBSP}km`);
    await choose(1);
    mockComputeRoute.mockClear();
    await pressTool('route-delete');
    expect(positions()).toEqual([B, C]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(screen.queryByLabelText('Point 2')).toBeNull();
    expect(distance()).toBe(`1,5${NNBSP}km`);
    expect(duration()).toBe(`5${NNBSP}min`);
  });

  it('removing the arrival: the one before becomes the arrival, no calculation, shorter figures', async () => {
    engineWith(
      [
        [A, B, { km: 2, s: 600 }],
        [B, C, { km: 1.5, s: 300 }],
      ],
      { km: 9, s: 9 },
    );
    await renderScreen();
    await addPoints(A, B, C);
    await choose(3);
    mockComputeRoute.mockClear();
    await pressTool('route-delete');
    expect(positions()).toEqual([A, B]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
    expect(distance()).toBe(`2,0${NNBSP}km`);
    expect(duration()).toBe(`10${NNBSP}min`);
  });

  it('removing points one by one down to nothing: hint back, figures at zero, no crash', async () => {
    await renderScreen();
    await addPoints(A, B);
    await choose(1);
    await pressTool('route-delete');
    await choose(1);
    await pressTool('route-delete');
    expect(pointIds()).toHaveLength(0);
    expect(screen.getByText('Touchez le départ sur la carte')).toBeTruthy();
    // p04-t7 A4: a dash under 2 points, no more "0 m" and "1 min".
    expect(distance()).toBe('—');
    expect(duration()).toBe('—');
  });
});

describe('C5: undo', () => {
  it('"Annuler" is greyed with no history', async () => {
    await renderScreen();
    expect(screen.getByTestId('route-undo')).toBeDisabled();
    await addPoints(A);
    expect(screen.getByTestId('route-undo')).toBeEnabled();
    await pressTool('route-undo');
    expect(screen.getByTestId('route-undo')).toBeDisabled();
    expect(pointIds()).toHaveLength(0);
  });

  it('undoing an add makes no calculation', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    mockComputeRoute.mockClear();
    await pressTool('route-undo');
    expect(positions()).toEqual([A, B]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('undoing a removal brings the old legs back from the cache, no calculation', async () => {
    await renderScreen();
    await addPoints(A, B, C, D);
    await choose(2);
    await pressTool('route-delete');
    mockComputeRoute.mockClear();
    await pressTool('route-undo');
    expect(positions()).toEqual([A, B, C, D]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.queryByTestId('route-error')).toBeNull();
  });

  it('undoing a move brings the old legs back from the cache, no calculation', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    await dragStart(2);
    await dragEnd(2, [6.15, 48.69]);
    expect(positions()[1]).toEqual([6.15, 48.69]);
    mockComputeRoute.mockClear();
    await pressTool('route-undo');
    expect(positions()).toEqual([A, B, C]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('undoing "Boucler" makes no calculation', async () => {
    await renderScreen();
    await addPoints(A, B);
    await pressTool('route-loop');
    expect(positions()).toEqual([A, B, A]);
    mockComputeRoute.mockClear();
    await pressTool('route-undo');
    expect(positions()).toEqual([A, B]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('undoes several actions one by one, in the reverse order', async () => {
    await renderScreen();
    await addPoints(A, B, C, D);
    await choose(2);
    await pressTool('route-delete'); // A C D
    await pressTool('route-loop'); // A C D A
    expect(positions()).toEqual([A, C, D, A]);
    mockComputeRoute.mockClear();
    await pressTool('route-undo');
    expect(positions()).toEqual([A, C, D]);
    await pressTool('route-undo');
    expect(positions()).toEqual([A, B, C, D]);
    await pressTool('route-undo');
    expect(positions()).toEqual([A, B, C]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });
});

describe('C6: Boucler', () => {
  it('is greyed with 0 and 1 point, active from 2', async () => {
    await renderScreen();
    expect(screen.getByTestId('route-loop')).toBeDisabled();
    await addPoints(A);
    expect(screen.getByTestId('route-loop')).toBeDisabled();
    await addPoints(B);
    expect(screen.getByTestId('route-loop')).toBeEnabled();
  });

  it('adds the start as the last point and computes the closing leg', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    mockComputeRoute.mockClear();
    await pressTool('route-loop');
    expect(positions()).toEqual([A, B, C, A]);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    const sent = mockComputeRoute.mock.calls[0]?.[0] as {
      lon: number;
      lat: number;
    }[];
    expect(sent.map((p) => [p.lon, p.lat])).toEqual([C, A]);
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
  });
});

describe('C10: the summary', () => {
  it('is the sum of the legs and follows every action (hand sums, narrow space before the unit)', async () => {
    // Legs written by hand: A-B 2.0 km 600 s, B-C 1.5 km 300 s, C-D 0.3 km 20 s,
    // B-D 1.0 km 120 s. Sums computed by the tester, not by the code.
    engineWith(
      [
        [A, B, { km: 2, s: 600 }],
        [B, C, { km: 1.5, s: 300 }],
        [C, D, { km: 0.3, s: 20 }],
        [B, D, { km: 1, s: 120 }],
      ],
      { km: 9, s: 9 },
    );
    await renderScreen();
    // p04-t7 A4: a dash under 2 points, no more "0 m" and "1 min".
    expect(distance()).toBe('—');
    expect(duration()).toBe('—');
    await addPoints(A, B);
    expect(distance()).toBe(`2,0${NNBSP}km`); // 2.0 km
    expect(duration()).toBe(`10${NNBSP}min`); // 600 s
    await addPoints(C);
    expect(distance()).toBe(`3,5${NNBSP}km`); // 2.0 + 1.5
    expect(duration()).toBe(`15${NNBSP}min`); // 900 s
    await addPoints(D);
    expect(distance()).toBe(`3,8${NNBSP}km`); // 3.8 km (3.8 exactly)
    expect(duration()).toBe(`15${NNBSP}min`); // 920 s = 15.33 min
    await choose(3); // C
    await pressTool('route-delete'); // A B D: 2.0 + 1.0
    expect(distance()).toBe(`3,0${NNBSP}km`);
    expect(duration()).toBe(`12${NNBSP}min`); // 720 s
    await pressTool('route-undo');
    expect(distance()).toBe(`3,8${NNBSP}km`);
    expect(duration()).toBe(`15${NNBSP}min`);
    await pressTool('route-undo'); // back to A B C
    expect(distance()).toBe(`3,5${NNBSP}km`);
  });

  it('the duration never goes under "1 min", whatever the legs', async () => {
    engineWith([[A, B, { km: 0.012, s: 4 }]], { km: 9, s: 9 });
    await renderScreen();
    await addPoints(A, B);
    expect(distance()).toBe(`12${NNBSP}m`);
    expect(duration()).toBe(`1${NNBSP}min`);
  });

  it('writes hours as "1 h 35" with narrow spaces, kilometers with a comma', async () => {
    // External reference: mockup 10 of the design ("25,1 km", "1 h 35").
    engineWith([[A, B, { km: 25.1, s: 5700 }]], { km: 9, s: 9 });
    await renderScreen();
    await addPoints(A, B);
    expect(distance()).toBe(`25,1${NNBSP}km`);
    expect(duration()).toBe(`1${NNBSP}h${NNBSP}35`);
  });

  it('keeps the previous figures, faded, during a calculation', async () => {
    await renderScreen();
    await addPoints(A, B);
    let finish: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => (finish = resolve)),
    );
    await addPoints(C);
    expect(distance()).toBe(`2,0${NNBSP}km`);
    expect(
      StyleSheet.flatten(screen.getByTestId('route-figures').props.style)
        .opacity,
    ).toBeLessThan(1);
    await act(async () =>
      finish({ ok: true, shape: [B, C], distanceKm: 1, durationS: 60 }),
    );
    await flush();
    expect(distance()).toBe(`3,0${NNBSP}km`);
  });
});

describe('C12: an error aims at the right point', () => {
  const failWhen = (isBad: (p: LonLat) => boolean, kind = 'farFromPath') => {
    mockComputeRoute.mockImplementation(
      async (points: { lon: number; lat: number }[]): Promise<RouteResult> => {
        const [p, q] = points as [Pt, Pt];
        if (isBad([p.lon, p.lat]) || isBad([q.lon, q.lat])) {
          return { ok: false, error: kind as 'farFromPath' };
        }
        return {
          ok: true,
          shape: [
            [p.lon, p.lat],
            [q.lon, q.lat],
          ],
          distanceKm: 2,
          durationS: 600,
        };
      },
    );
  };

  it('a new point that fails is the refused one; the others stay and "Retirer ce point" removes it', async () => {
    await renderScreen();
    await addPoints(A, B);
    failWhen((p) => same(p, C));
    await addPoints(C);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.getByText('Aucun chemin trouvé')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(positions()).toEqual([A, B]);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(positions()).toEqual([A, B]);
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
  });

  it('a first point outside the zone is refused at once, without any engine call', async () => {
    await renderScreen();
    await addPoints(OUTSIDE);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(pointIds()).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.getByText('Touchez le départ sur la carte')).toBeTruthy();
  });

  it('a dragged middle point whose final calculation fails is the refused one, not the last point', async () => {
    await renderScreen();
    await addPoints(A, B, C, D);
    const target: LonLat = [6.16, 48.69];
    failWhen((p) => same(p, target));
    await dragStart(2);
    await dragEnd(2, target);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    // The three others are still drawn as points.
    expect(positions()).toEqual([A, C, D]);
    // "Retirer ce point" drops the dragged one, not the arrival.
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    await flush();
    expect(positions()).toEqual([A, C, D]);
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
    // The dragged point is gone from the model: undo twice would find it,
    // but the screen shows 3 points with the right ends.
    expect(textOf(screen.getByLabelText('Point 2'))).toBe('2');
  });

  it('a failed calculation during the drag keeps the old line; the error comes at the release', async () => {
    await renderScreen();
    await addPoints(A, B, C);
    const target: LonLat = [6.16, 48.69];
    failWhen((p) => same(p, target));
    await dragStart(2);
    await act(async () => {
      mockAnnotations[pointIds()[1] as string].onDrag(event(target));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    // Old shapes of the two legs stay in the preview source.
    const preview = mockSources['draft-preview'].features.map(
      (f: any) => f.geometry.coordinates,
    );
    expect(preview).toHaveLength(2);
    expect(preview).toContainEqual([A, B]);
    expect(preview).toContainEqual([B, C]);
    expect(screen.queryByTestId('route-error')).toBeNull();
    await dragEnd(2, target);
    expect(screen.getByTestId('route-error')).toBeTruthy();
  });

  it('after a removal whose new leg fails, the arrival of that leg is the refused point', async () => {
    await renderScreen();
    await addPoints(A, B, C, D);
    // B -> D fails: D is the arrival of the new leg.
    mockComputeRoute.mockImplementation(
      async (points: { lon: number; lat: number }[]): Promise<RouteResult> => {
        const [p, q] = points as [Pt, Pt];
        if (same([p.lon, p.lat], B) && same([q.lon, q.lat], D)) {
          return { ok: false, error: 'noRoute' };
        }
        return { ok: true, shape: [A, B], distanceKm: 1, durationS: 60 };
      },
    );
    await choose(3); // C
    await pressTool('route-delete');
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    // Points drawn: A and B only (D is the refused marker).
    expect(positions()).toEqual([A, B]);
  });

  it('the engine that rejects or throws never crashes the screen', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockComputeRoute.mockRejectedValue(new Error('boom'));
    await renderScreen();
    await addPoints(A, B);
    await wait(20);
    spy.mockRestore();
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.getByTestId('route-error')).toBeTruthy();
  });
});
