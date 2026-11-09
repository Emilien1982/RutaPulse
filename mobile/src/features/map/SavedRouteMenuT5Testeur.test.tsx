// Tests du testeur, T5 : le menu « ⋮ » de /route/[id] (maquette 40 états 3 et 5 :
// même menu que la liste ; après « Supprimer », retour à la liste par dismissTo).
// The
// database is a real SQLite in memory; MapLibre, the router, the zone and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

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
  const [title, message, buttons] = alert.mock.calls.at(-1)!;
  return { title, message, buttons } as {
    title: string;
    message?: string;
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

describe('menu de /route/[id]', () => {
  it('Android : mêmes trois actions que la liste, titre = nom', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    expect(lastAlert().title).toBe('Boucle');
    expect(lastAlert().buttons.map((b) => b.text)).toEqual([
      'Supprimer',
      'Exporter en GPX',
      'Renommer',
    ]);
  });

  it('iOS : ActionSheetIOS avec les mêmes entrées, Supprimer en destructif', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => undefined);
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    const opts = sheet.mock.calls[0]![0];
    expect(opts.options.slice(0, 3)).toEqual([
      'Renommer',
      'Exporter en GPX',
      'Supprimer',
    ]);
    expect(opts.destructiveButtonIndex).toBe(2);
  });

  it('renommer met le titre à jour aussitôt', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    await press(lastAlert().buttons[2]);
    await fireEvent.changeText(
      screen.getByLabelText("Nom de l'itinéraire"),
      'Été 🌲',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Renommer' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(screen.getByTestId('info-title')).toHaveTextContent('Été 🌲');
    expect((await listRoutes(db))[0]!.name).toBe('Été 🌲');
  });

  it('renommer avec un nom vide est refusé et le titre ne change pas', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    await press(lastAlert().buttons[2]);
    await fireEvent.changeText(
      screen.getByLabelText("Nom de l'itinéraire"),
      '  ',
    );
    expect(screen.getByText("Donnez un nom à l'itinéraire.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Renommer' }));
    expect((await listRoutes(db))[0]!.name).toBe('Boucle');
  });

  it("« Garder » ne supprime rien et ne quitte pas l'écran", async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    await press(lastAlert().buttons[0]);
    await press(lastAlert().buttons[0]);
    expect(await listRoutes(db)).toHaveLength(1);
    expect(mockDismissTo).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('« Supprimer » efface, puis revient à la liste par dismissTo (pas back)', async () => {
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    await press(lastAlert().buttons[0]);
    expect(lastAlert().message).toBe(
      "L'itinéraire sera effacé du téléphone. Pour le garder ailleurs, exportez-le d'abord en GPX.",
    );
    await press(lastAlert().buttons[1]);
    expect(await listRoutes(db)).toHaveLength(0);
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/routes');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('C8 : zone supprimée, le menu « ⋮ » reste (renommer, supprimer)', async () => {
    await insertRoute(db, sampleCreated({ name: 'Longemer' }));
    mockZone = null;
    mockInstalled = [];
    await open();
    await fireEvent.press(screen.getByTestId('info-menu'));
    expect(lastAlert().buttons).toHaveLength(3);
  });
});
