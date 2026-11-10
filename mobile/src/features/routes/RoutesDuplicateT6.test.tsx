// "Dupliquer" from the list (ADR 0020, section 7 bis; spec C16): the copy
// arrives at the top, the screen reader announces it, the list scrolls back
// to the top. Real SQLite in memory; router and zones are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, ActionSheetIOS, Platform } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import { menuEntry } from '@/ui/testing/androidMenu';

import { RoutesScreen } from './RoutesScreen';

let mockDb: Promise<unknown>;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: () => Promise.resolve({ canceled: true, assets: null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneInService: () => ({ id: 'nancy' }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({
    data: [{ zone: { id: 'nancy' }, installedAt: '2026-11-01' }],
  }),
}));

let db: NodeSqlDb;
const original = Platform.OS;
const setOs = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const rowNames = () =>
  screen
    .getAllByTestId(/^route-row-\d+$/)
    .map((row) => String(row.props.accessibilityLabel).split(',')[0]);

let announce: jest.SpyInstance;
beforeEach(async () => {
  setOs('android');
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  announce = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
  announce.mockClear();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  await insertRoute(db, sampleCreated({ name: 'Ancien', savedAt: 1_000 }));
  await insertRoute(db, sampleCreated({ name: 'Récent', savedAt: 2_000 }));
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <RoutesScreen />
    </QueryClientProvider>,
  );
  await settle();
});
afterEach(() => {
  setOs(original as 'ios' | 'android');
  jest.restoreAllMocks();
  db.close();
});

it('duplicates from the Android sheet: the copy is on top, announced', async () => {
  expect(rowNames()).toEqual(['Récent', 'Ancien']);
  await fireEvent.press(screen.getByTestId('route-menu-1'));
  await act(async () => menuEntry('duplicate').onPress());
  await settle();
  expect(rowNames()).toEqual(['Ancien (copie)', 'Récent', 'Ancien']);
  expect(await listRoutes(db)).toHaveLength(3);
  expect(announce).toHaveBeenCalledWith('Copie créée : Ancien (copie).');
  expect(screen.queryByTestId('menu-cancel')).toBeNull();
});

it('duplicates from the iOS action sheet (second entry)', async () => {
  setOs('ios');
  const sheet = jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation(() => undefined);
  await fireEvent.press(screen.getByTestId('route-menu-2'));
  await act(async () => sheet.mock.calls[0]![1](1));
  await settle();
  expect(rowNames()[0]).toBe('Récent (copie)');
  expect(await listRoutes(db)).toHaveLength(3);
  expect(announce.mock.calls).toEqual([['Copie créée\u00A0: Récent (copie).']]);
});

it('duplicates twice: "(copie)" then "(copie 2)"', async () => {
  for (let i = 0; i < 2; i++) {
    await fireEvent.press(screen.getByTestId('route-menu-2'));
    await act(async () => menuEntry('duplicate').onPress());
    await settle();
  }
  expect(rowNames().slice(0, 2)).toEqual([
    'Récent (copie 2)',
    'Récent (copie)',
  ]);
});
