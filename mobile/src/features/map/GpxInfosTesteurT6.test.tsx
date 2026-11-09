// Tests written by the tester from the spec (C10, C12), ADR 0019 (answers 5 and
// 6) and mockup 40 (states 6b and 6d): a GPX is imported by the real screen of
// the list, then the Infos screen of the new route is opened with its id.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { ReactNode } from 'react';

// The test follows the user across two screens (list, then Infos): the one
// place where a feature imports another, in a test only.
// eslint-disable-next-line no-restricted-imports
import { RoutesScreen } from '@/features/routes/RoutesScreen';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import type { Zone } from '@/core/zones/catalogue';

import { SavedRouteInfoScreen } from './SavedRouteInfoScreen';

const mockPush = jest.fn();
const mockPicker = jest.fn();
const mockFiles = new Map<string, string>();
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
    back: jest.fn(),
    push: mockPush,
    dismissTo: jest.fn(),
    navigate: jest.fn(),
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
  useZoneInService: () => mockZone,
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
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockPicker(...args),
}));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return (mockFiles.get(this.uri) ?? '').length;
    }
    text() {
      return Promise.resolve(mockFiles.get(this.uri) ?? '');
    }
    delete() {}
  }
  return { File, Directory: class {}, Paths: {} };
});
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: jest.fn(),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computePointHeights: jest.fn(),
  computeHeights: jest.fn().mockResolvedValue({
    ok: true,
    profile: [
      [0, 200],
      [1000, 230],
    ],
  }),
  computeTerrain: jest.fn().mockResolvedValue({ ok: true, edges: [] }),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({
    readText: jest.fn().mockResolvedValue(
      JSON.stringify({
        formatVersion: 1,
        waysByLevel: [[], [], [], [], [], [], []],
      }),
    ),
  }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const NANCY: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 5,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [
    { path: 'difficulty.json', bytes: 1, sha256: 'x', url: 'https://x/y' },
  ],
};

const gpxOf = (pts: [number, number][], name: string) =>
  `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${name}</name></metadata><trk><trkseg>${pts
    .map(
      ([lon, lat], i) =>
        `<trkpt lat="${lat}" lon="${lon}"><ele>${200 + i}</ele></trkpt>`,
    )
    .join('')}</trkseg></trk></gpx>`;

let db: NodeSqlDb;
async function settle(n = 10) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
async function importThenInfos(text: string) {
  mockFiles.set('file:///cache/x.gpx', text);
  mockPicker.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/x.gpx', name: 'x.gpx', size: text.length }],
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const list = await render(
    <QueryClientProvider client={client}>
      <RoutesScreen />
    </QueryClientProvider>,
  );
  await settle();
  await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
  await settle();
  const [row] = await listRoutes(db);
  // Close the sheet if it is open ("Plus tard" or "Fermer").
  const later = screen.queryByText('Plus tard') ?? screen.queryByText('Fermer');
  if (later) await fireEvent.press(later);
  await list.unmount();
  mockId = String(row.id);
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <SavedRouteInfoScreen />
    </QueryClientProvider>,
  );
  await settle(20);
  return row;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockFiles.clear();
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  mockZone = NANCY;
  mockInstalled = [NANCY];
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
});
afterEach(async () => {
  jest.restoreAllMocks();
  db.close();
});

describe('answers 5 and 6: the Infos screen of a GPX just imported (6b)', () => {
  it('shows the name, 42,1 km and 4 h 13 at 10 km/h, and "Modifier"', async () => {
    const span = 42_100 / ((6_378_160 * Math.PI) / 180);
    const pts: [number, number][] = Array.from({ length: 101 }, (_, i) => [
      6.2,
      48.5 + (span * i) / 100,
    ]);
    const row = await importThenInfos(gpxOf(pts, 'Longue sortie'));
    expect(mockPush).toHaveBeenCalledWith(`/route/${row.id}`);
    expect(screen.getByTestId('info-title').props.children).toBe(
      'Longue sortie',
    );
    expect(screen.getByTestId('info-distance')).toHaveTextContent(/42,1/);
    expect(screen.getByTestId('info-duration')).toHaveTextContent(
      /4[\s\u00A0]h[\s\u00A0]13/,
    );
    expect(screen.getByTestId('info-modify')).toBeTruthy();
    expect(screen.getByText('Modifier')).toBeTruthy();
  });

  it('the subtitle says the origin: "GPX importé"', async () => {
    await importThenInfos(
      gpxOf(
        [
          [6.18, 48.69],
          [6.2, 48.71],
        ],
        'Courte',
      ),
    );
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /Zone Nancy.*GPX importé le/,
    );
  });
});

describe('C12 / 6d: the Infos screen of a GPX outside every zone', () => {
  it('has distance and duration, and says what is missing', async () => {
    mockZone = null;
    mockInstalled = [];
    await importThenInfos(
      gpxOf(
        [
          [-60, -30],
          [-59.9, -30.1],
        ],
        'Patagonie',
      ),
    );
    expect(screen.getByTestId('info-title').props.children).toBe('Patagonie');
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /Hors de vos zones.*GPX importé le/,
    );
    expect(screen.getByTestId('info-distance')).toBeTruthy();
    expect(screen.getByTestId('info-duration')).toBeTruthy();
    expect(screen.queryByTestId('info-ascent')).toBeNull();
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Hors de vos zones.*D\+, profil, terrain et difficulté indisponibles/,
    );
    expect(screen.getByTestId('info-see-zones')).toBeTruthy();
  });
});
