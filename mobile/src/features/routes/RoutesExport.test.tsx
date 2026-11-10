// "Exporter en GPX" in the menu of the list (T6; ADR 0019, section 8).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleGpx } from '@/core/routes/testing/sampleRoutes';

import { menuEntry } from '@/ui/testing/androidMenu';

import { RoutesScreen } from './RoutesScreen';

const mockShare = jest.fn();
const mockWritten: string[] = [];
let mockDb: Promise<unknown>;

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
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneInService: () => null,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [] }),
}));

let db: NodeSqlDb;
const originalOs = Platform.OS;

beforeEach(async () => {
  jest.clearAllMocks();
  mockWritten.length = 0;
  mockShare.mockResolvedValue(undefined);
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    value: originalOs,
    configurable: true,
  });
  jest.restoreAllMocks();
  db.close();
});

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

it('opens the share sheet with the GPX of the route of the line, whatever its zone', async () => {
  await insertRoute(db, sampleGpx({ name: 'Importé' }));
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <RoutesScreen />
    </QueryClientProvider>,
  );
  await settle();
  await fireEvent.press(screen.getByLabelText('Actions de Importé'));
  expect(screen.getByText('Exporter en GPX')).toBeTruthy();
  await act(async () => menuEntry('export').onPress());
  await settle();
  expect(mockWritten).toHaveLength(1);
  expect(mockWritten[0]).toContain('<name>Importé</name>');
  expect(mockShare).toHaveBeenCalledWith(
    'file:///c/export/Importé.gpx',
    expect.objectContaining({ UTI: 'com.topografix.gpx' }),
  );
});
