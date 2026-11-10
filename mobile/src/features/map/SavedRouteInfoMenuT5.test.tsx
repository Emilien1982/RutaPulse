// The "⋮" menu of the Infos screen of a saved route (T5; ADR 0019, section 13,
// point 4). The
// database is a real SQLite in memory; MapLibre, the router, the zone and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { menuEntry, menuTexts } from '@/ui/testing/androidMenu';

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

let alert: jest.SpyInstance;
const lastAlert = () => {
  const [title, , buttons] = alert.mock.calls.at(-1)!;
  return { title, buttons } as {
    title: string;
    buttons: { text: string; onPress?: () => void }[];
  };
};
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
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    value: originalOs,
    configurable: true,
  });
  jest.restoreAllMocks();
});

describe('the "⋮" menu of the Infos screen', () => {
  it('has the same four actions as the list', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    expect(alert).not.toHaveBeenCalled();
    expect(menuTexts()).toEqual([
      'Renommer',
      'Dupliquer',
      'Exporter en GPX',
      'Supprimer',
    ]);
  });

  it('renames, and the title follows', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    await press(menuEntry('rename'));
    await fireEvent.changeText(screen.getByTestId('rename-input'), 'Autre nom');
    await fireEvent.press(screen.getByTestId('rename-submit'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(screen.getByTestId('info-title')).toHaveTextContent('Autre nom');
    expect((await listRoutes(db))[0]?.name).toBe('Autre nom');
  });

  it('deletes after the confirmation, then goes back to the list', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    await press(menuEntry('delete'));
    expect(lastAlert().buttons.map((b) => b.text)).toEqual([
      'Garder',
      'Supprimer',
    ]);
    expect(mockDismissTo).not.toHaveBeenCalled();
    await press(lastAlert().buttons[0]);
    expect(await listRoutes(db)).toHaveLength(1);
    await press(lastAlert().buttons[1]);
    expect(await listRoutes(db)).toHaveLength(0);
    expect(mockDismissTo).toHaveBeenCalledWith('/routes');
  });

  it('is there on a route whose zone is deleted', async () => {
    await insertRoute(db, sampleCreated());
    mockZone = null;
    mockInstalled = [];
    await open();
    expect(screen.getByTestId('info-menu')).toBeTruthy();
  });
});

describe('the "⋮" button of the unreadable-route screen', () => {
  it('sits under the status bar, not behind it', async () => {
    mockTop = 47;
    await insertRoute(db, sampleCreated());
    await db.run("UPDATE routes SET draft = 'x'");
    await open();
    const style = StyleSheet.flatten(
      screen.getByTestId('info-menu').props.style,
    );
    expect(style.top).toBe(47 + 12);
    mockTop = 0;
  });
});
