// "Modifier" opens the creation on the track of the route (B3 of the T8
// comparison): box of the route, margin of 48, top bar and bottom panel left
// free, zoom 17 at most. MapLibre and the engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';
import { DraftSession } from './DraftSession';

const mockEaseTo = jest.fn();
let mockDb: Promise<unknown>;
let mockParams: Record<string, string> = {};
let mockLoaded: (() => void) | undefined;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: {
      children: ReactNode;
      onDidFinishLoadingMap?: () => void;
    }) => {
      mockLoaded = props.onDidFinishLoadingMap;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: mockEaseTo }));
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
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  usePreventRemove: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [nancy] }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: jest.fn(),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: async () => ({ ok: false }),
  computeTerrain: async () => ({ ok: false }),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ readText: async () => null }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const nancy: ReadyMarker = {
  localFormat: 1,
  installedAt: '2026-11-01T10:00:00.000Z',
  zone: {
    id: 'nancy',
    name: 'Nancy',
    version: 5,
    bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 1,
    files: [],
  },
};

let db: NodeSqlDb;

async function settle() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

// Cleared after each test: the cache would keep Jest alive.
let client = new QueryClient();
afterEach(() => client.clear());

async function openCreation(routeId?: number) {
  client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <DraftSession routeId={routeId}>
        <DraftScreen />
      </DraftSession>
    </QueryClientProvider>,
  );
  await settle();
}

// Two points 60 m apart: tiny, so the zoom is capped at 17.
const SMALL = [
  { id: 1, lon: 6.18, lat: 48.69 },
  { id: 2, lon: 6.1808, lat: 48.69 },
];
const BIG = [
  { id: 1, lon: 6.0, lat: 48.6 },
  { id: 2, lon: 6.3, lat: 48.8 },
];
const leg = (points: { lon: number; lat: number }[]) => ({
  mode: 'path' as const,
  zoneVersion: 5,
  distanceKm: 0.3,
  durationS: 100,
  shape: points.map((p) => [p.lon, p.lat] as [number, number]),
});
const saved = (points: typeof SMALL) =>
  sampleCreated({
    zone: { id: 'nancy', version: 5, name: 'Nancy' },
    draft: { points, modes: ['path'] },
    legs: [leg(points)],
  });

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
});
afterEach(() => db.close());

const measure = (height: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('draft-bottom'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
    });
  });

const loadMap = () =>
  act(async () => {
    mockLoaded?.();
  });

describe('B3: "Modifier" shows the track', () => {
  it('centers a tiny route at zoom 17, margin 48 around the panels', async () => {
    await insertRoute(db, saved(SMALL));
    await openCreation(1);
    expect(mockEaseTo).not.toHaveBeenCalled();
    await measure(200);
    // Panel measured but map not loaded: the native camera is not there yet.
    expect(mockEaseTo).not.toHaveBeenCalled();
    await loadMap();
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    const view = mockEaseTo.mock.calls[0]![0];
    expect(view.zoom).toBe(17);
    expect(view.center[0]).toBeCloseTo(6.1804, 4);
    expect(view.center[1]).toBeCloseTo(48.69, 4);
    // The bar (112 until measured) and the panel (200) stay free.
    expect(view.padding).toEqual({
      top: 160,
      bottom: 248,
      left: 48,
      right: 48,
    });
    expect(view.duration).toBe(0);
  });

  it('zooms out for a long route, and fits it once only', async () => {
    await insertRoute(db, saved(BIG));
    await openCreation(1);
    await loadMap();
    await measure(200);
    const view = mockEaseTo.mock.calls[0]![0];
    expect(view.zoom).toBeLessThan(17);
    expect(view.zoom).toBeGreaterThan(7);
    await measure(260);
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
  });

  it('leaves a new creation alone', async () => {
    await openCreation();
    await measure(200);
    await loadMap();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('applies the fit when the map loads before the panel is measured', async () => {
    await insertRoute(db, saved(SMALL));
    await openCreation(1);
    await loadMap();
    expect(mockEaseTo).not.toHaveBeenCalled();
    await measure(200);
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
  });
});
