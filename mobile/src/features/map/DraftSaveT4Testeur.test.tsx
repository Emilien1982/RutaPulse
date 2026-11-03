// Tester's tests of task T4 (phase 6): "Enregistrer" in the creation and
// "Modifier" (spec C3, C4, C7; choices 1, 2 and 6; ADR 0019 sections 4 and 11;
// mockup 40, states 8a and 8b). Written from the spec, the ADR and the
// mockup. The database is a real SQLite in memory; MapLibre, the router and
// the engine are faked. No simulator: the walk-throughs are for T7.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import {
  MIGRATIONS,
  migrate,
  RoutesTooNewError,
} from '@/core/routes/migrations';
import { getRoute, insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftRoot } from './DraftRoot';
import { peekDraftTarget, setDraftTarget } from './draftTarget';
import { DraftScreen } from './DraftScreen';
import { DraftSession, useDraftSession } from './DraftSession';

const mockComputeRoute = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockPrevent: { value: boolean; callback: (o: any) => void } | undefined;
let mockDb: Promise<unknown>;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => (
      <View testID="map">{props.children}</View>
    ),
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: jest.fn() }));
      return null;
    },
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
    Layer: () => null,
    GeoJSONSource: () => null,
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    ViewAnnotation: (props: { children: ReactNode }) => <>{props.children}</>,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: (value: boolean, callback: (o: any) => void) => {
    mockPrevent = { value, callback };
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
const mockInstalled: ReadyMarker[] = [];
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
  computeHeights: async () => ({
    ok: true,
    profile: [
      [0, 100],
      [1000, 120],
    ],
  }),
  computeTerrain: async () => ({
    ok: true,
    edges: [{ use: 'path', density: 1, lengthKm: 1, wayId: 1 }],
  }),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ readText: async () => null }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const NANCY = {
  id: 'nancy',
  name: 'Nancy',
  version: 5,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [],
};
mockInstalled.push({
  localFormat: 1,
  installedAt: '2026-11-01T10:00:00.000Z',
  zone: NANCY,
});

type Session = ReturnType<typeof useDraftSession>;
const holder: { current: Session | null } = { current: null };
const session = new Proxy({} as Session, {
  get: (_, key) => (holder.current as never)[key],
});
function Probe() {
  const current = useDraftSession();
  useEffect(() => {
    holder.current = current;
  });
  return null;
}

let db: NodeSqlDb;

async function settle() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
const act_ = async (fn: () => void) => {
  await act(async () => fn());
  await settle();
};

async function openCreation(routeId?: number) {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftSession routeId={routeId}>
        <Probe />
        <DraftScreen />
      </DraftSession>
    </QueryClientProvider>,
  );
  await settle();
}
async function openRoot() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftRoot>
        <Probe />
        <DraftScreen />
      </DraftRoot>
    </QueryClientProvider>,
  );
  await settle();
}

// The fake engine draws a straight line between the two points.
function straightEngine() {
  mockComputeRoute.mockImplementation(
    async (points: { lon: number; lat: number }[]) => ({
      ok: true,
      shape: points.map((p) => [p.lon, p.lat]),
      distanceKm: 2,
      durationS: 600,
    }),
  );
}
const saveButton = () => screen.getByTestId('route-save');
const isOff = () => saveButton().props.accessibilityState?.disabled === true;

// The expected default name, written out by hand: "Itinéraire du 3 nov.".
const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];
function todayName(): string {
  const now = new Date();
  return `Itinéraire du ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockPrevent = undefined;
  setDraftTarget(null);
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  straightEngine();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
});
afterEach(() => db.close());

describe('C3, C4, choices 1 and 2: "Enregistrer" of a new route', () => {
  it('is off with no point and with the start alone', async () => {
    await openCreation();
    expect(isOff()).toBe(true);
    await act_(() => session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 }));
    expect(isOff()).toBe(true);
    await act_(() => fireEvent.press(saveButton()));
    expect(await listRoutes(db)).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('is on from 2 points, and keeps the default name without asking for one', async () => {
    await openCreation();
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    expect(isOff()).toBe(false);
    await act_(() => fireEvent.press(saveButton()));
    // Choice 1: no dialog asks for a name.
    expect(Alert.alert).not.toHaveBeenCalled();
    const lines = await listRoutes(db);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.name).toBe(todayName());
    // C3: what is kept.
    const route = await getRoute(db, lines[0]!.id);
    expect(route).toMatchObject({
      origin: 'created',
      name: todayName(),
      zone: { id: 'nancy', version: 5, name: 'Nancy' },
      draft: {
        points: [
          expect.objectContaining({ lon: 6.1, lat: 48.66 }),
          expect.objectContaining({ lon: 6.14, lat: 48.68 }),
        ],
        modes: ['path'],
      },
    });
    const legs = route && 'legs' in route ? route.legs : [];
    expect(legs).toEqual([
      {
        mode: 'path',
        zoneVersion: 5,
        distanceKm: 2,
        durationS: 600,
        shape: [
          [6.1, 48.66],
          [6.14, 48.68],
        ],
      },
    ]);
    expect(route && route.readable && route.createdAt).toBe(
      route && route.readable && route.savedAt,
    );
  });

  it('closes the creation, then opens /route/[id] (choice 2), and announces the name', async () => {
    await openCreation();
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    await act_(() => fireEvent.press(saveButton()));
    const [line] = await listRoutes(db);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/route/${line!.id}`);
    expect(mockBack.mock.invocationCallOrder[0]).toBeLessThan(
      mockPush.mock.invocationCallOrder[0]!,
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `Itinéraire enregistré : ${todayName()}.`,
    );
  });

  it('shows the name as the title of the creation once saved', async () => {
    await openCreation();
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    await act_(() => fireEvent.press(saveButton()));
    expect(screen.getByRole('header', { name: todayName() })).toBeTruthy();
  });

  it('a double press keeps one route only', async () => {
    await openCreation();
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    // Two taps, one after the other, without waiting for the database.
    await act(async () => fireEvent.press(saveButton()));
    await act(async () => fireEvent.press(saveButton()));
    await settle();
    expect(await listRoutes(db)).toHaveLength(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('numbers the second and the third route of the day "(2)" and "(3)"', async () => {
    await insertRoute(db, sampleCreated({ name: todayName() }));
    await insertRoute(db, sampleCreated({ name: `${todayName()} (2)` }));
    await openCreation();
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    await act_(() => fireEvent.press(saveButton()));
    const names = (await listRoutes(db)).map((r) => r.name);
    expect(names).toContain(`${todayName()} (3)`);
    expect(names).toHaveLength(3);
  });

  it('asks nothing when closing right after saving', async () => {
    await openCreation();
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    expect(mockPrevent?.value).toBe(true);
    await act_(() => fireEvent.press(saveButton()));
    expect(mockPrevent?.value).toBe(false);
  });

  it('database too new: a clear message, no route written, no navigation, no crash', async () => {
    mockDb = Promise.reject(new RoutesTooNewError());
    mockDb.catch(() => undefined);
    await openCreation();
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    await act_(() => fireEvent.press(saveButton()));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Itinéraires indisponibles',
      'Mettez à jour RutaPulse pour retrouver vos itinéraires.',
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    // Nothing was written in the real database either.
    expect(await listRoutes(db)).toHaveLength(0);
    // Still on the screen, still guarded.
    expect(mockPrevent?.value).toBe(true);
  });
});

describe('C7: "Modifier"', () => {
  const points = [
    { id: 1, lon: 6.1, lat: 48.66 },
    { id: 2, lon: 6.14, lat: 48.68 },
    { id: 3, lon: 6.18, lat: 48.7 },
    { id: 4, lon: 6.2, lat: 48.72 },
  ];
  // Saved shapes with a detour that the fake engine never draws: if a leg is
  // calculated again, the detour is lost.
  const leg = (i: number) => ({
    mode: 'path' as const,
    zoneVersion: 3,
    distanceKm: 1 + i,
    durationS: 100 * (i + 1),
    shape: [
      [points[i]!.lon, points[i]!.lat],
      [
        Math.round((points[i]!.lon + 0.001) * 1e6) / 1e6,
        Math.round((points[i]!.lat + 0.0123) * 1e6) / 1e6,
      ],
      [points[i + 1]!.lon, points[i + 1]!.lat],
    ] as [number, number][],
  });
  const saved = () =>
    sampleCreated({
      name: 'Mon tour',
      createdAt: 1_000,
      savedAt: 1_000,
      zone: { id: 'nancy', version: 3, name: 'Nancy' },
      draft: { points, modes: ['path', 'path', 'path'] },
      legs: [leg(0), leg(1), leg(2)],
      distanceKm: 6,
    });
  const rawRow = () => db.first('SELECT * FROM routes WHERE id = 1');

  it('reopens with the saved name, no calculation, and nothing to save', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    expect(screen.getByRole('header', { name: 'Mon tour' })).toBeTruthy();
    expect(screen.queryByText('Nouvel itinéraire')).toBeNull();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(session.store.state.draft.points).toHaveLength(4);
    expect(isOff()).toBe(true);
    expect(mockPrevent?.value).toBe(false);
  });

  it('moving a point recalculates only its two legs; the others keep their exact shape', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    // Point 3 touches legs 2-3 and 3-4: two calls, not three.
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    const starts = mockComputeRoute.mock.calls.map((c) => c[0][0]);
    expect(starts).toEqual([
      expect.objectContaining({ lon: 6.14, lat: 48.68 }),
      expect.objectContaining({ lon: 6.19, lat: 48.71 }),
    ]);
    await act_(() => fireEvent.press(saveButton()));
    const route = await getRoute(db, 1);
    const legs = route && 'legs' in route ? route.legs : [];
    expect(legs).toHaveLength(3);
    expect(legs[0]).toEqual(saved().legs[0]);
    expect(legs[1]).toMatchObject({ mode: 'path', zoneVersion: 5 });
    expect(legs[2]).toMatchObject({ mode: 'path', zoneVersion: 5 });
  });

  it('moving the first point recalculates one leg only', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 1, lon: 6.11, lat: 48.67 }),
    );
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    await act_(() => fireEvent.press(saveButton()));
    const route = await getRoute(db, 1);
    const legs = route && 'legs' in route ? route.legs : [];
    expect(legs[1]).toEqual(saved().legs[1]);
    expect(legs[2]).toEqual(saved().legs[2]);
  });

  it('undo after a move: back to the saved shape with no calculation, nothing to save', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    mockComputeRoute.mockClear();
    await act_(() => session.dispatch({ type: 'undo' }));
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(isOff()).toBe(true);
    expect(mockPrevent?.value).toBe(false);
  });

  it('closing the loop calculates the new leg only, and the three old ones are kept', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    await act_(() => session.dispatch({ type: 'loop' }));
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(mockComputeRoute.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ lon: 6.2, lat: 48.72 }),
      expect.objectContaining({ lon: 6.1, lat: 48.66 }),
    ]);
    await act_(() => fireEvent.press(saveButton()));
    const route = await getRoute(db, 1);
    const legs = route && 'legs' in route ? route.legs : [];
    expect(legs).toHaveLength(4);
    expect(legs.slice(0, 3)).toEqual(saved().legs);
  });

  it('"Enregistrer" replaces the same row: one route, same name, same creation date', async () => {
    await insertRoute(db, saved());
    await insertRoute(db, sampleCreated({ name: 'Autre', savedAt: 500 }));
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    await act_(() => fireEvent.press(saveButton()));
    const lines = await listRoutes(db);
    expect(lines).toHaveLength(2);
    const mine = await getRoute(db, 1);
    expect(mine).toMatchObject({ id: 1, name: 'Mon tour', createdAt: 1_000 });
    expect(mine && mine.readable && mine.savedAt).toBeGreaterThan(1_000);
    // Choice 1 of the ADR answers: saving moves it to the top of the list.
    expect(lines[0]?.id).toBe(1);
    // It goes back to the Infos screen below: no new screen.
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    // The other route is untouched.
    const other = await getRoute(db, 2);
    expect(other).toMatchObject({ name: 'Autre', savedAt: 500 });
  });

  it('the figures saved are the new ones of the new shape', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    await act_(() => fireEvent.press(saveButton()));
    const route = await getRoute(db, 1);
    // Kept legs 1 + two new ones of 2 km each (fake engine).
    expect(route && route.readable && route.distanceKm).toBeCloseTo(1 + 4, 5);
  });

  it('"Fermer sans enregistrer" after a change: "Abandonner les changements ?", base unchanged', async () => {
    await insertRoute(db, saved());
    const before = await rawRow();
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    expect(mockPrevent?.value).toBe(true);
    const repeat = jest.fn();
    await act_(() => mockPrevent!.callback({ repeat }));
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Abandonner les changements ?');
    expect(message).toBe("L'itinéraire gardé ne change pas.");
    expect(buttons.map((b: { text: string }) => b.text)).toEqual([
      'Continuer',
      'Abandonner',
    ]);
    await act_(() => buttons[1].onPress());
    expect(repeat).toHaveBeenCalled();
    expect(await rawRow()).toEqual(before);
    expect(await listRoutes(db)).toHaveLength(1);
  });

  it('"Fermer sans enregistrer" without a change asks nothing', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    expect(mockPrevent?.value).toBe(false);
  });
});

describe('C7: the hand-over by draftTarget', () => {
  const saved = () =>
    sampleCreated({
      name: 'Mon tour',
      zone: { id: 'nancy', version: 5, name: 'Nancy' },
    });

  it('the target is cleared as soon as the creation is mounted', async () => {
    await insertRoute(db, saved());
    setDraftTarget(1);
    expect(peekDraftTarget()).toBe(1);
    await openRoot();
    expect(peekDraftTarget()).toBeNull();
    // And the creation did open that route.
    expect(screen.getByRole('header', { name: 'Mon tour' })).toBeTruthy();
  });

  it('a new creation after a reopened one starts empty', async () => {
    await insertRoute(db, saved());
    setDraftTarget(1);
    await openRoot();
    expect(session.store.state.draft.points.length).toBeGreaterThan(0);
    await screen.unmount();
    holder.current = null;

    await openRoot();
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    expect(session.store.state.draft.points).toHaveLength(0);
    expect(session.savedStore.state.routeId).toBeNull();
    expect(isOff()).toBe(true);
  });

  it('a creation without a target starts empty and saves as a new route', async () => {
    await insertRoute(db, saved());
    await openRoot();
    expect(session.store.state.draft.points).toHaveLength(0);
    await act_(() => {
      session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
      session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    });
    await act_(() => fireEvent.press(saveButton()));
    expect(await listRoutes(db)).toHaveLength(2);
  });
});
