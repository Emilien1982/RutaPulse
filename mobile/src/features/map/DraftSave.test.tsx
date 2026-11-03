// "Enregistrer" and "Modifier" in the creation (ADR 0019, section 4; spec C3,
// C7). The database is a real SQLite in memory; MapLibre, the router and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { defaultRouteName } from '@/core/routes/routeName';
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
import { setDraftTarget } from './draftTarget';
import { DraftScreen } from './DraftScreen';
import { DraftSession, useDraftSession } from './DraftSession';
import { RouteInfoScreen } from './RouteInfoScreen';

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

const zone = {
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
  zone,
});

type Session = ReturnType<typeof useDraftSession>;
const holder: { current: Session | null } = { current: null };
// The session of the screen under test, read when used.
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

const act_ = async (fn: () => void) => {
  await act(async () => fn());
  await settle();
};
const A = { lon: 6.1, lat: 48.66 };
const B = { lon: 6.14, lat: 48.68 };

// The fake engine draws a straight shape and says which zone drew it.
function engine() {
  mockComputeRoute.mockImplementation(
    async (points: { lon: number; lat: number }[]) => ({
      ok: true,
      shape: points.map((p) => [p.lon, p.lat]),
      distanceKm: 2,
      durationS: 600,
    }),
  );
}

async function drawAB() {
  await act_(() => {
    session.dispatch({ type: 'add', ...A });
    session.dispatch({ type: 'add', ...B });
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockPrevent = undefined;
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  engine();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
});
afterEach(() => db.close());

describe('"Enregistrer" of a new route', () => {
  it('is off under 2 points, on once the figures are known', async () => {
    await openCreation();
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
    await drawAB();
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it('keeps the route at once with the default name, then opens Infos', async () => {
    await openCreation();
    await drawAB();
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));

    const [line] = await listRoutes(db);
    expect(line?.name).toBe(defaultRouteName(new Date()));
    const route = await getRoute(db, line!.id);
    expect(route).toMatchObject({
      origin: 'created',
      readable: true,
      zone: { id: 'nancy', version: 5, name: 'Nancy' },
      distanceKm: 2,
      durationS: 600,
      ascentM: 20,
      descentM: 0,
    });
    expect(route && 'legs' in route && route.legs).toEqual([
      expect.objectContaining({ mode: 'path', zoneVersion: 5 }),
    ]);
    // The creation closes, then the saved route opens (mockup 40, 8a).
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/route/${line!.id}`);
    expect(mockBack.mock.invocationCallOrder[0]).toBeLessThan(
      mockPush.mock.invocationCallOrder[0]!,
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `Itinéraire enregistré\u00A0: ${defaultRouteName(new Date())}.`,
    );
  });

  it('numbers a second route of the same day "(2)"', async () => {
    await insertRoute(
      db,
      sampleCreated({ name: defaultRouteName(new Date()) }),
    );
    await openCreation();
    await drawAB();
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const names = (await listRoutes(db)).map((r) => r.name);
    expect(names).toContain(`${defaultRouteName(new Date())} (2)`);
  });

  it('shows the name in the title of the creation and of Infos after saving', async () => {
    await openCreation();
    await drawAB();
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const name = defaultRouteName(new Date());
    expect(screen.getByRole('header', { name })).toBeTruthy();
    // Nothing changed since: off again, and the cross asks nothing.
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(mockPrevent?.value).toBe(false);
  });

  it('says so when the database is too new, and keeps nothing', async () => {
    mockDb = Promise.reject(new RoutesTooNewError());
    mockDb.catch(() => undefined);
    await openCreation();
    await drawAB();
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Itinéraires indisponibles',
      'Mettez à jour RutaPulse pour retrouver vos itinéraires.',
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Infos after "Enregistrer"', () => {
  it('shows the saved name as title and the zone and origin under it', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle du Bois' }));
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <DraftSession routeId={1}>
          <RouteInfoScreen />
        </DraftSession>
      </QueryClientProvider>,
    );
    await settle();
    expect(screen.getByTestId('info-title')).toHaveTextContent(
      'Boucle du Bois',
    );
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy · créé le/,
    );
  });
});

describe('C7: "Modifier"', () => {
  // Four points, three legs saved under zone v3 while v5 is in service.
  const points = [
    { id: 1, lon: 6.1, lat: 48.66 },
    { id: 2, lon: 6.14, lat: 48.68 },
    { id: 3, lon: 6.18, lat: 48.7 },
    { id: 4, lon: 6.2, lat: 48.72 },
  ];
  const savedLeg = (i: number) => ({
    mode: 'path' as const,
    zoneVersion: 3,
    distanceKm: 1 + i,
    durationS: 100 * (i + 1),
    // A shape that the fake engine would not give.
    shape: [
      [points[i]!.lon, points[i]!.lat],
      [Math.round((points[i]!.lon + 0.01) * 1e6) / 1e6, points[i]!.lat],
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
      legs: [savedLeg(0), savedLeg(1), savedLeg(2)],
      distanceKm: 6,
    });

  it('reopens with the name as title and no calculation for untouched legs', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    expect(screen.getByRole('header', { name: 'Mon tour' })).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    // Nothing changed: "Enregistrer" is off, the cross asks nothing.
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(mockPrevent?.value).toBe(false);
    expect(session.store.state.past).toEqual([]);
  });

  it('recomputes only the legs next to a moved point, then replaces the same row', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    // Legs 2-3 and 3-4 only.
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(mockComputeRoute.mock.calls.map((c) => c[0][0].lon)).toEqual([
      6.14, 6.19,
    ]);
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: false,
    });

    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const lines = await listRoutes(db);
    expect(lines).toHaveLength(1);
    const route = await getRoute(db, 1);
    expect(route).toMatchObject({
      name: 'Mon tour',
      createdAt: 1_000,
      zone: { id: 'nancy', version: 5, name: 'Nancy' },
    });
    expect(route && route.readable && route.savedAt).toBeGreaterThan(1_000);
    const legs = route && 'legs' in route ? route.legs : [];
    expect(legs.map((l) => l.mode === 'path' && l.zoneVersion)).toEqual([
      3, 5, 5,
    ]);
    // The untouched leg keeps its saved shape.
    expect(legs[0]).toEqual(saved().legs[0]);
    // Back to the same screen, read again: no new screen is pushed.
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    // Off again until the next change.
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('"Annuler" back to the saved place finds the saved shape without a call', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    mockComputeRoute.mockClear();
    await act_(() => session.dispatch({ type: 'undo' }));
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(session.store.state.draft).toBe(session.savedStore.state.savedDraft);
  });

  it('closing after a change asks "Abandonner les changements ?" and leaves the route intact', async () => {
    await insertRoute(db, saved());
    const before = await getRoute(db, 1);
    await openCreation(1);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    expect(mockPrevent?.value).toBe(true);
    const repeat = jest.fn();
    await act_(() => mockPrevent!.callback({ repeat }));
    const [title, text, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Abandonner les changements ?');
    expect(text).toBe("L'itinéraire gardé ne change pas.");
    await act_(() => buttons[1].onPress());
    expect(repeat).toHaveBeenCalled();
    expect(await getRoute(db, 1)).toEqual(before);
  });

  it('through the root of the layout: "Modifier" reopens the saved route', async () => {
    await insertRoute(db, saved());
    setDraftTarget(1);
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <DraftRoot>
          <Probe />
          <DraftScreen />
        </DraftRoot>
      </QueryClientProvider>,
    );
    await settle();
    expect(screen.getByRole('header', { name: 'Mon tour' })).toBeTruthy();
    expect(session.store.state.draft.points).toHaveLength(4);
    await act_(() =>
      session.dispatch({ type: 'move', id: 3, lon: 6.19, lat: 48.71 }),
    );
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    // The same row is replaced: no second route.
    expect(await listRoutes(db)).toHaveLength(1);
  });

  it('the off button of a reopened route does not ask for a start and an arrival', async () => {
    await insertRoute(db, saved());
    await openCreation(1);
    expect(screen.getByTestId('route-save').props.accessibilityLabel).toBe(
      'Enregistrer\u00A0: aucun changement à enregistrer',
    );
  });

  it('refuses a route whose zone is not the one held', async () => {
    await insertRoute(
      db,
      sampleCreated({ zone: { id: 'metz', version: 1, name: 'Metz' } }),
    );
    await openCreation(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Zone absente',
      expect.stringContaining('ne peut pas être modifié'),
    );
    expect(mockBack).toHaveBeenCalled();
    expect(screen.queryByTestId('route-save')).toBeNull();
  });
});
