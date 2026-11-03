// Two quick presses on "Enregistrer" keep the route once (T5, small rest of
// T4: a lock in a ref, as `saving` is read too late). The database is a real SQLite in memory; MapLibre, the router and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';
import { DraftSession, useDraftSession } from './DraftSession';

const mockComputeRoute = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
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
  usePreventRemove: () => undefined,
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

describe('"Enregistrer" pressed twice at once', () => {
  it('keeps the route once', async () => {
    await openCreation();
    await drawAB();
    // Both presses run in the same tick, before React shows `saving`.
    // The accessibility click of the button runs its `onPress` at once.
    const press = screen.getByTestId('route-save').props.onClick;
    await act(async () => {
      press({ stopPropagation() {} });
      press({ stopPropagation() {} });
    });
    await settle();
    expect(await listRoutes(db)).toHaveLength(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
