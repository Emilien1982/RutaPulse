// Tests du testeur, T5 : réponse 3 d'Émilien (ADR 0019, § 13) — la
// confirmation de suppression d'une zone dit combien d'itinéraires l'utilisent.
// Phrases attendues, mot pour mot, d'après la réponse 3 :
//   « 2 itinéraires utilisent cette zone. Ils resteront, sans carte ni terrain. »
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import { parseCatalogue } from '@/core/zones/catalogue';
import catalogueV3 from '@/core/zones/fixtures/catalogueV3.json';
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
const ZONE_REF = { id: zone.id, version: zone.version, name: zone.name };

async function askDelete(): Promise<{
  message: string;
  buttons: { text: string; style?: string }[];
}> {
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
  await new Promise((resolve) => setTimeout(resolve, 50));
  await fireEvent.press(
    screen.getByRole('button', {
      name: `Actions de la zone ${zone.name} : supprimer`,
    }),
  );
  const [, message, buttons] = alert.mock.calls[0]!;
  return { message: message as string, buttons: buttons as never };
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

describe("suppression d'une zone utilisée par des itinéraires", () => {
  it('2 itinéraires : phrase au pluriel, mot pour mot', async () => {
    await insertRoute(db, sampleCreated({ zone: ZONE_REF }));
    await insertRoute(db, sampleCreated({ zone: ZONE_REF, name: 'Autre' }));
    const { message } = await askDelete();
    expect(message).toContain(
      '2 itinéraires utilisent cette zone. Ils resteront, sans carte ni terrain.',
    );
  });

  it('1 itinéraire : phrase au singulier', async () => {
    await insertRoute(db, sampleCreated({ zone: ZONE_REF }));
    const { message } = await askDelete();
    expect(message).toContain(
      '1 itinéraire utilise cette zone. Il restera, sans carte ni terrain.',
    );
    expect(message).not.toContain('itinéraires');
  });

  it('0 itinéraire : aucune phrase en plus', async () => {
    const { message } = await askDelete();
    expect(message).toBe(
      'La carte de cette zone sera effacée du téléphone. Vous pourrez la télécharger à nouveau.',
    );
  });

  it("l'itinéraire d'une autre zone ne compte pas", async () => {
    await insertRoute(db, sampleCreated({ zone: ZONE_REF }));
    await insertRoute(
      db,
      sampleCreated({
        zone: { id: 'metz', version: 1, name: 'Metz' },
        name: 'M',
      }),
    );
    await insertRoute(db, sampleGpx({ zone: null }));
    const { message } = await askDelete();
    expect(message).toContain('1 itinéraire utilise cette zone.');
  });

  it('garde les boutons Garder et Supprimer', async () => {
    await insertRoute(db, sampleCreated({ zone: ZONE_REF }));
    const { buttons } = await askDelete();
    expect(buttons.map((b) => b.text)).toEqual(['Garder', 'Supprimer']);
  });
});
