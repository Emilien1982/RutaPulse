// Tester complement of RoutesDuplicateT6: scroll to top, danger colour and
// displayed order of the Android sheet. (original header follows)
// "Dupliquer" from the list (ADR 0020, section 7 bis; spec C16): the copy
// arrives at the top, the screen reader announces it, the list scrolls back
// to the top. Real SQLite in memory; router and zones are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, ScrollView } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import { colors } from '@/ui/theme';
import { menuEntry, menuTexts } from '@/ui/testing/androidMenu';

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
let scrollTo: jest.SpyInstance;
beforeEach(async () => {
  setOs('android');
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo' as never);
  scrollTo.mockClear();
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

it('scrolls back to the top when a copy arrives, not on first load', async () => {
  expect(scrollTo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('route-menu-1'));
  await act(async () => menuEntry('duplicate').onPress());
  await settle();
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
});

it('does not scroll after a rename', async () => {
  await fireEvent.press(screen.getByTestId('route-menu-1'));
  await act(async () => menuEntry('rename').onPress());
  await settle();
  await fireEvent.changeText(screen.getByTestId('rename-input'), 'Autre nom');
  await fireEvent.press(screen.getByTestId('rename-submit'));
  await settle();
  expect(rowNames()).toContain('Autre nom');
  expect(scrollTo).not.toHaveBeenCalled();
});

describe('the Android sheet as rendered', () => {
  it('shows the four entries in the order of the spec', async () => {
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    const labels = screen
      .getAllByRole('button')
      .map((b) => String(b.props.accessibilityLabel))
      .filter((l) =>
        ['Renommer', 'Dupliquer', 'Exporter en GPX', 'Supprimer'].includes(l),
      );
    expect(labels).toEqual([
      'Renommer',
      'Dupliquer',
      'Exporter en GPX',
      'Supprimer',
    ]);
    expect(menuTexts()).toEqual(labels);
  });

  it('draws "Supprimer" in the danger colour, the others not', async () => {
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    expect(screen.getByText('Supprimer')).toHaveStyle({ color: colors.danger });
    expect(screen.getByText('Renommer')).not.toHaveStyle({
      color: colors.danger,
    });
  });
});
