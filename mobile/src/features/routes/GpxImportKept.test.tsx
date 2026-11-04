// The import when the name cannot be read back, and the announcement of a name
// that ends with a full stop (corrections of phase 6). Same fakes as
// GpxImport.test.tsx; the database is a real SQLite in memory.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Alert } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import type { Zone } from '@/core/zones/catalogue';

import { RoutesScreen } from './RoutesScreen';

let mockText = '';
let mockGetRouteFails = false;
let mockDb: Promise<unknown>;
const mockPush = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: () =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'file:///cache/DocumentPicker/x.gpx', name: 'x.gpx' }],
    }),
}));
jest.mock('expo-file-system', () => {
  class File {
    get size() {
      return mockText.length;
    }
    text() {
      return Promise.resolve(mockText);
    }
    delete() {}
  }
  return { File, Directory: class {}, Paths: {} };
});
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneInService: () => NANCY,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [] }),
}));
jest.mock('@/core/routes/routeRepo', () => {
  const actual = jest.requireActual('@/core/routes/routeRepo');
  return {
    ...actual,
    getRoute: (...args: unknown[]) =>
      mockGetRouteFails
        ? Promise.reject(new Error('read failed'))
        : actual.getRoute(...args),
  };
});

const NANCY: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 5,
  bbox: { lonMin: 5.84, lonMax: 6.52, latMin: 48.47, latMax: 48.92 },
  osmDate: '2026-10-01',
  totalBytes: 95_400_000,
  files: [],
};
const gpx = (name: string) =>
  `<gpx version="1.1"><metadata><name>${name}</name></metadata><trk><trkseg>` +
  '<trkpt lat="48.69" lon="6.18"/><trkpt lat="48.74" lon="6.23"/>' +
  '</trkseg></trk></gpx>';

let db: NodeSqlDb;
let client: QueryClient;
let alert: jest.SpyInstance;
let announce: jest.SpyInstance;

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
async function importFile() {
  await render(
    <QueryClientProvider client={client}>
      <RoutesScreen onDownloadZone={jest.fn()} />
    </QueryClientProvider>,
  );
  await settle();
  await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
  await settle();
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetRouteFails = false;
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  announce = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
});
afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
});

describe('import of a GPX file (corrections)', () => {
  it('announces a name ending with a full stop without a double stop', async () => {
    mockText = gpx('Tour.');
    await importFile();
    expect(announce).toHaveBeenCalledWith('GPX importé : Tour.');
  });

  it('opens the route and does not fail when the name cannot be read back', async () => {
    mockText = gpx('Tour');
    mockGetRouteFails = true;
    await importFile();
    const rows = await listRoutes(db);
    expect(rows).toHaveLength(1);
    expect(alert).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/route/${rows[0].id}`);
  });
});
