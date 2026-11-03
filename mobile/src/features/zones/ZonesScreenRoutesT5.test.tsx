// Deleting a zone warns when saved routes use it (ADR 0019, section 13, point
// 8; answer 3 of Émilien). The database is a real SQLite in memory.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import catalogueV3 from '@/core/zones/fixtures/catalogueV3.json';
import { parseCatalogue } from '@/core/zones/catalogue';
import { LOCAL_FORMAT } from '@/core/zones/zoneLayout';

import { ZonesScreen } from './ZonesScreen';

let mockDb: Promise<unknown>;
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('./zoneDownloader', () => ({
  ...jest.requireActual('./zoneDownloader'),
  getZoneDownloader: () => ({ remove: jest.fn(() => Promise.resolve()) }),
}));
const zone = parseCatalogue(catalogueV3).zones[0];
const mockInstalled = [
  { localFormat: LOCAL_FORMAT, installedAt: '2026-10-24T10:12:31Z', zone },
];
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/settings/useSettings', () => ({
  useSettings: () => ({ data: { wifiOnly: true } }),
  useSetWifiOnly: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ availableSpace: () => Promise.resolve(1e10) }),
}));

let db: NodeSqlDb;
const BASE =
  'La carte de cette zone sera effacée du téléphone. Vous pourrez la télécharger à nouveau.';

async function askDelete(): Promise<string | null | undefined> {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ZonesScreen />
    </QueryClientProvider>,
  );
  await screen.findByText('Prête sans réseau');
  // The counts are read while the screen is shown.
  await new Promise((resolve) => setTimeout(resolve, 30));
  await fireEvent.press(
    screen.getByRole('button', {
      name: `Actions de la zone ${zone.name} : supprimer`,
    }),
  );
  return alert.mock.calls[0]![1];
}

beforeEach(async () => {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(catalogueV3) }),
  ) as unknown as typeof fetch;
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
});
afterEach(() => {
  jest.restoreAllMocks();
  db.close();
});

describe('deleting a zone that routes use', () => {
  const inZone = () =>
    sampleCreated({
      zone: { id: zone.id, version: zone.version, name: zone.name },
    });

  it('adds nothing when no route uses it', async () => {
    expect(await askDelete()).toBe(BASE);
  });

  it('says "1 itinéraire utilise cette zone" for one route', async () => {
    await insertRoute(db, inZone());
    expect(await askDelete()).toBe(
      `${BASE}\n\n1 itinéraire utilise cette zone. Il restera, sans carte ni terrain.`,
    );
  });

  it('says "2 itinéraires utilisent cette zone" for two routes', async () => {
    await insertRoute(db, inZone());
    await insertRoute(db, inZone());
    expect(await askDelete()).toBe(
      `${BASE}\n\n2 itinéraires utilisent cette zone. Ils resteront, sans carte ni terrain.`,
    );
  });

  it('does not count the routes of another zone', async () => {
    await insertRoute(
      db,
      sampleCreated({ zone: { id: 'metz', version: 1, name: 'Metz' } }),
    );
    expect(await askDelete()).toBe(BASE);
  });
});
