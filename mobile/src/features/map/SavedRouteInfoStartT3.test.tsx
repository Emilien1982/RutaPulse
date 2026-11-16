// "Démarrer le suivi" on the Infos screen of a saved route (ADR 0021, 5.2;
// spec C4). The
// database is a real SQLite in memory; MapLibre, the router, the zone and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { Alert } from 'react-native';

import { SavedRouteInfoScreen } from './SavedRouteInfoScreen';

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
const mockPermission = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: { children: ReactNode }) => <View>{props.children}</View>,
    Camera: () => null,
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
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockPermission(),
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
jest.mock('./useGlyphsReady', () => ({
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
      <SavedRouteInfoScreen />
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

describe('Démarrer le suivi', () => {
  it('opens the tracking screen when the position is granted', async () => {
    await insertRoute(db, sampleCreated());
    mockPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    await open();
    await fireEvent.press(screen.getByTestId('info-start'));
    await act(async () => {});
    expect(mockPush).toHaveBeenCalledWith('/tracking/1');
  });

  it('stays on the Infos screen with the box "Position désactivée" when refused', async () => {
    await insertRoute(db, sampleCreated());
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open();
    await fireEvent.press(screen.getByTestId('info-start'));
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Position désactivée',
      "Autorisez la position dans les réglages pour suivre l'itinéraire.",
      [
        expect.objectContaining({ text: 'Annuler' }),
        expect.objectContaining({ text: 'Ouvrir les réglages' }),
      ],
    );
    expect(screen.getByTestId('info-title')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('is there for an imported GPX', async () => {
    await insertRoute(db, sampleGpx());
    mockPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    await open();
    expect(screen.getByTestId('info-start')).toBeOnTheScreen();
    expect(screen.getByTestId('info-modify')).toBeOnTheScreen();
  });

  it('is there when the zone is deleted (the tracking then follows the track alone)', async () => {
    await insertRoute(db, sampleCreated());
    mockInstalled = [];
    mockZone = null;
    await open();
    expect(screen.getByTestId('info-start')).toBeOnTheScreen();
  });

  it('is there for a GPX outside every zone', async () => {
    await insertRoute(db, sampleGpx({ zone: null }));
    mockInstalled = [];
    mockZone = null;
    await open();
    expect(screen.getByTestId('info-start')).toBeOnTheScreen();
  });
});
