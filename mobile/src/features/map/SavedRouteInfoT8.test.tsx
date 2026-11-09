// Notices of the Infos screen (T8 comparison, M7, M8, M9). The
// database is a real SQLite in memory; MapLibre, the router, the zone and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fr } from '@/core/i18n/fr';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { catalogueKey } from '@/shared-data/zones/useCatalogue';
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
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

async function open(catalogue?: { zones: Zone[] }): Promise<void> {
  client = new QueryClient();
  if (catalogue) {
    client.setQueryData(catalogueKey, { formatVersion: 1, ...catalogue });
  }
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
afterEach(() => {
  client.clear();
  db.close();
});

describe('M7: the notice has its "!" icon', () => {
  it('shows the ring before the text', async () => {
    mockZone = null;
    mockInstalled = [];
    await insertRoute(db, sampleGpx());
    await open();
    expect(
      screen.getByTestId('info-notice-icon', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});

describe('M8: where to find the zone of a GPX outside every zone', () => {
  const outside = async () => {
    mockZone = null;
    mockInstalled = [];
    await insertRoute(db, sampleGpx());
  };
  const metz: Zone = {
    ...nancy(1, false),
    id: 'metz',
    name: 'Metz',
    // The start of the sample GPX is at 6.18, 48.69.
    bbox: { lonMin: 6.0, latMin: 48.6, lonMax: 6.4, latMax: 48.8 },
  };

  it('says the zone that holds the track', async () => {
    await outside();
    await open({ zones: [metz] });
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Hors de vos zones : D\+, profil, terrain et difficulté indisponibles\. Ce tracé est dans la zone Metz\.Voir/,
    );
  });

  it('says so when no zone holds it', async () => {
    await outside();
    await open({
      zones: [{ ...metz, bbox: { ...metz.bbox, lonMin: 7, lonMax: 8 } }],
    });
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /indisponibles\. Ce tracé n'est dans aucune zone de RutaPulse pour l'instant\.Voir/,
    );
  });

  it('adds nothing without a catalogue in memory', async () => {
    await outside();
    await open();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /^!Hors de vos zones : D\+, profil, terrain et difficulté indisponibles\.Voir les zones$/,
    );
  });
});

describe('M9: "inactive", not "pas en service"', () => {
  it('uses the words of the designer', async () => {
    await insertRoute(db, sampleCreated());
    mockZone = { ...nancy(1, false), id: 'metz', name: 'Metz' };
    mockInstalled = [nancy(5, true), mockZone];
    await open();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Zone Nancy inactive : carte, profil, terrain et difficulté indisponibles\. RutaPulse n'utilise qu'une zone à la fois pour l'instant\./,
    );
  });

  it('has no more internal word in the texts', () => {
    const keys = [
      'routes.problemNotInService',
      'routes.noticeNotInService',
      'routes.noticeNotInServiceText',
      'route.zoneAbsentText',
    ] as const;
    for (const key of keys) {
      expect(fr[key]).not.toMatch(/en service/);
    }
    expect(fr['routes.problemNotInService']).toBe('Zone {zone} inactive');
    expect(fr['route.zoneAbsentText']).toBe(
      "La carte de cet itinéraire n'est pas disponible\u00A0: il ne peut pas être modifié.",
    );
  });
});
