// "Exporter en GPX" in the "⋮" menu of the Infos screen of a saved route (T6;
// ADR 0019, section 8). The database is a real SQLite in memory; MapLibre, the
// router, the zone, the engine, the file system and the share sheet are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { menuEntry } from '@/ui/testing/androidMenu';

import { SavedRouteInfoScreen } from './SavedRouteInfoScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockReadText = jest.fn();
const mockShare = jest.fn();
const mockPointHeights = jest.fn();
const mockWritten: string[] = [];
let mockDb: Promise<unknown>;
let mockZone: Zone | null;
let mockInstalled: Zone[];
let mockId = '1';
let mockTop = 0;

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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: mockTop, bottom: 0, left: 0, right: 0 }),
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
jest.mock('expo-file-system', () => {
  class Entry {
    uri: string;
    constructor(base: { uri: string }, name: string) {
      this.uri = `${base.uri}/${name}`;
    }
    exists = false;
    delete() {}
    create() {}
    write(text: string) {
      mockWritten.push(text);
    }
  }
  return {
    Directory: Entry,
    File: Entry,
    Paths: { cache: { uri: 'file:///c' } },
  };
});
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computePointHeights: (...args: unknown[]) => mockPointHeights(...args),
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
  mockWritten.length = 0;
  mockShare.mockResolvedValue(undefined);
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

async function press(button: { onPress?: () => void } | undefined) {
  await act(async () => button?.onPress?.());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const originalOs = Platform.OS;
beforeEach(() => {
  // The Android dialog is the one that `Alert.alert` shows.
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    value: originalOs,
    configurable: true,
  });
  jest.restoreAllMocks();
});

describe('"Exporter en GPX" in the Infos menu', () => {
  async function exportFromMenu() {
    await fireEvent.press(screen.getByTestId('info-menu'));
    await press(menuEntry('export'));
  }

  it('shares the GPX of a created route, with altitudes on a usable zone', async () => {
    mockPointHeights.mockImplementation(async (shape: unknown[]) => ({
      ok: true,
      heights: shape.map(() => 250),
    }));
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await exportFromMenu();
    expect(mockShare).toHaveBeenCalledWith(
      'file:///c/export/Boucle.gpx',
      expect.objectContaining({ mimeType: 'application/gpx+xml' }),
    );
    expect(mockWritten[0]).toContain('<name>Boucle</name>');
    expect(mockWritten[0]).toContain('<ele>250</ele>');
  });

  it('shares a created route whose zone is gone, without altitudes', async () => {
    mockZone = null;
    mockInstalled = [];
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await exportFromMenu();
    expect(mockPointHeights).not.toHaveBeenCalled();
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockWritten[0]).not.toContain('<ele>');
  });

  it('shares an imported GPX outside every zone', async () => {
    mockZone = null;
    mockInstalled = [];
    await insertRoute(db, sampleGpx({ name: 'Importé' }));
    await open();
    await exportFromMenu();
    expect(mockShare).toHaveBeenCalledWith(
      'file:///c/export/Importé.gpx',
      expect.anything(),
    );
    expect(mockWritten[0]).toContain('<ele>212</ele>');
  });
});
