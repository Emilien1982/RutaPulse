// The tracking screen opened on a saved route (ADR 0021, sections 1.1, 4 and
// 5.5; spec C4 and the decision of 10 November on a GPX outside the zones). The
// database is a real SQLite in memory; MapLibre, the router, the zone and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { TrackingScreen } from './TrackingScreen';

const mockTraceRoute = jest.fn();
const mockMatchedEdges = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockReadText = jest.fn();
let mockDb: Promise<unknown>;
let mockZone: Zone | null;
let mockInstalled: Zone[];
let mockId = '1';
let mockOnFix: ((location: unknown) => void) | null = null;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: { children: ReactNode }) => <View>{props.children}</View>,
    Camera: () => null,
    Images: () => null,
    Layer: () => null,
    GeoJSONSource: () => null,
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    dismissTo: mockDismissTo,
  }),
  usePreventRemove: jest.fn(),
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  watchPositionAsync: (_options: unknown, onFix: (l: unknown) => void) => {
    mockOnFix = onFix;
    return Promise.resolve({ remove: jest.fn() });
  },
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('@/shared-data/routing/computeGuidance', () => ({
  computeTraceRoute: (...args: unknown[]) => mockTraceRoute(...args),
  computeMatchedEdges: (...args: unknown[]) => mockMatchedEdges(...args),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneHold: () => mockZone,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({
    data: mockInstalled.map((zone) => ({ zone, installedAt: '2026-11-01' })),
  }),
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
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ readText: mockReadText }),
}));
jest.mock('../useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const nancy = (version: number, withTable: boolean): Zone => ({
  id: 'nancy',
  name: 'Nancy',
  version,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: withTable
    ? [{ path: 'difficulty.json', bytes: 1, sha256: 'x', url: 'https://x/y' }]
    : [],
});
const TABLE = JSON.stringify({
  formatVersion: 1,
  waysByLevel: [[], [10], [], [], [], [], []],
});

let db: NodeSqlDb;
let client: QueryClient;

async function open(): Promise<void> {
  client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <TrackingScreen />
    </QueryClientProvider>,
  );
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

beforeEach(async () => {
  jest.clearAllMocks();
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  mockZone = nancy(5, true);
  mockInstalled = [mockZone];
  mockId = '1';
  mockOnFix = null;
  mockTraceRoute.mockResolvedValue({ ok: false, error: 'failed' });
  mockMatchedEdges.mockResolvedValue({ ok: false, error: 'failed' });
  mockReadText.mockResolvedValue(TABLE);
  mockHeights.mockResolvedValue({
    ok: true,
    profile: [
      [0, 100],
      [1000, 130],
    ],
  });
  mockTerrain.mockResolvedValue({
    ok: true,
    edges: [
      { use: 'path', density: 1, lengthKm: 0.5, wayId: 10 },
      { use: 'path', density: 1, lengthKm: 0.5, wayId: 11 },
    ],
  });
});
afterEach(() => db.close());

async function fix(lon: number, lat: number) {
  await act(async () => {
    mockOnFix?.({ coords: { longitude: lon, latitude: lat, accuracy: 5 } });
  });
}

describe('tracking of a saved route', () => {
  it('asks the engine for the directions of a created route on its zone, and shows the ascent left of the Infos screen', async () => {
    await insertRoute(db, sampleCreated());
    await open();
    expect(mockTraceRoute).toHaveBeenCalledTimes(1);
    // The saved track, a point every 20 m at most: its three points here.
    expect(mockTraceRoute.mock.calls[0]?.[0].length).toBeGreaterThanOrEqual(3);
    await fix(6.18, 48.69);
    expect(screen.getByTestId('tracking-climb')).toHaveTextContent('60\u202Fm');
    expect(screen.getByTestId('tracking-remaining')).toBeOnTheScreen();
  });

  it('follows a GPX outside every zone: no engine call, "Hors de la zone téléchargée", ascent "—"', async () => {
    await insertRoute(db, sampleGpx({ zone: null }));
    mockInstalled = [];
    mockZone = null;
    await open();
    expect(mockTraceRoute).not.toHaveBeenCalled();
    expect(mockHeights).not.toHaveBeenCalled();
    await fix(6.18, 48.69);
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Hors de la zone téléchargée',
    );
    expect(screen.getByTestId('tracking-climb')).toHaveTextContent('—');
  });

  it('follows a created route whose zone was deleted the same way', async () => {
    await insertRoute(db, sampleCreated());
    mockInstalled = [];
    mockZone = null;
    await open();
    expect(mockTraceRoute).not.toHaveBeenCalled();
    await fix(6.18, 48.69);
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Hors de la zone téléchargée',
    );
  });

  it('keeps going when the Infos screen below reads the route again, even with an error', async () => {
    await insertRoute(db, sampleCreated());
    await open();
    expect(mockTraceRoute).toHaveBeenCalledTimes(1);
    const failing = Promise.reject(new Error('disk'));
    failing.catch(() => undefined);
    mockDb = failing;
    await act(async () => {
      await client.invalidateQueries();
    });
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByTestId('tracking-panel')).toBeOnTheScreen();
    // The directions were not asked again.
    expect(mockTraceRoute).toHaveBeenCalledTimes(1);
  });

  it('goes back when the route does not exist', async () => {
    mockId = '99';
    await open();
    expect(mockBack).toHaveBeenCalled();
  });
});
