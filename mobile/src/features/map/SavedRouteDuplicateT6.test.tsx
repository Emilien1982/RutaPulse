// "Dupliquer" from the Infos screen (ADR 0020, section 7 bis; spec C16): back
// to the list, and an announcement for the screen reader.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import { menuEntry } from '@/ui/testing/androidMenu';

import { SavedRouteInfoScreen } from './SavedRouteInfoScreen';

const mockDismissTo = jest.fn();
let mockDb: Promise<unknown>;

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
    back: jest.fn(),
    push: jest.fn(),
    dismissTo: mockDismissTo,
  }),
  useLocalSearchParams: () => ({ id: '1' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneHold: () => null,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [] }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

let db: NodeSqlDb;
const original = Platform.OS;

async function settle() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    value: original,
    configurable: true,
  });
  jest.restoreAllMocks();
  db.close();
});

it('duplicates, goes back to the list and announces the copy', async () => {
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  const announce = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
  await insertRoute(db, sampleCreated({ name: 'Boucle' }));
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <SavedRouteInfoScreen />
    </QueryClientProvider>,
  );
  await settle();
  await fireEvent.press(screen.getByTestId('info-menu'));
  await act(async () => menuEntry('duplicate').onPress());
  await settle();
  expect((await listRoutes(db)).map((r) => r.name)).toEqual([
    'Boucle (copie)',
    'Boucle',
  ]);
  expect(mockDismissTo).toHaveBeenCalledWith('/routes');
  expect(announce).toHaveBeenCalledWith('Copie créée : Boucle (copie).');
});
