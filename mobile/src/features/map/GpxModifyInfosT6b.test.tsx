// "Modifier" on the Infos screen of a GPX (C10, ADR 0020, section 8): one test
// per line of the table, and an edited GPX reopened as a route. Real SQLite;
// MapLibre, the router, the zone and the engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { peekDraftTarget, setDraftTarget } from './draftTarget';
import { SavedRouteInfoScreen } from './SavedRouteInfoScreen';

const mockPush = jest.fn();
let mockDb: Promise<unknown>;
let mockZone: Zone | null;
let mockInstalled: Zone[];

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
  useRouter: () => ({ back: jest.fn(), push: mockPush, dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({ id: '1' }),
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
  computeRoute: jest.fn(),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: async () => ({
    ok: true,
    profile: [
      [0, 100],
      [1000, 130],
    ],
  }),
  computeTerrain: async () => ({ ok: true, edges: [] }),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ readText: async () => '{}' }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const nancy: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 5,
  bbox: { lonMin: 6.1, latMin: 48.6, lonMax: 6.3, latMax: 48.8 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [],
};
const INSIDE: [number, number][] = [
  [6.18, 48.69],
  [6.19, 48.7],
  [6.2, 48.71],
];
const LEAVING: [number, number][] = [
  [6.18, 48.69],
  [6.2, 48.71],
  [6.5, 48.9],
];
const ZONE_REF = { id: 'nancy', version: 5, name: 'Nancy' };

let db: NodeSqlDb;
async function open() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
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
  setDraftTarget(null);
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  mockZone = nancy;
  mockInstalled = [nancy];
});
afterEach(() => db.close());

describe('C10: the "Modifier" button of a GPX follows routeZoneStatus', () => {
  it('usable: yes, and it sets the gpx target then opens the creation', async () => {
    await insertRoute(db, sampleGpx({ zone: ZONE_REF, track: INSIDE }));
    await open();
    fireEvent.press(screen.getByTestId('info-modify'));
    expect(peekDraftTarget()).toEqual({ kind: 'gpx', id: 1 });
    expect(mockPush).toHaveBeenCalledWith('/draft');
  });

  it('leaves (starts inside, goes out): yes', async () => {
    await insertRoute(db, sampleGpx({ zone: ZONE_REF, track: LEAVING }));
    await open();
    expect(screen.getByTestId('info-notice')).toBeTruthy();
    fireEvent.press(screen.getByTestId('info-modify'));
    expect(peekDraftTarget()).toEqual({ kind: 'gpx', id: 1 });
    expect(mockPush).toHaveBeenCalledWith('/draft');
  });

  it('outside (no zone): no', async () => {
    mockZone = null;
    mockInstalled = [];
    await insertRoute(db, sampleGpx({ zone: null, track: LEAVING }));
    await open();
    expect(screen.getByTestId('info-see-zones')).toBeTruthy();
    expect(screen.queryByTestId('info-modify')).toBeNull();
  });

  it('deleted zone: no', async () => {
    mockZone = null;
    mockInstalled = [];
    await insertRoute(db, sampleGpx({ zone: ZONE_REF, track: INSIDE }));
    await open();
    expect(screen.getByTestId('info-notice')).toBeTruthy();
    expect(screen.queryByTestId('info-modify')).toBeNull();
  });

  it('zone not in service: no', async () => {
    mockZone = { ...nancy, id: 'metz', name: 'Metz' };
    mockInstalled = [nancy, mockZone];
    await insertRoute(db, sampleGpx({ zone: ZONE_REF, track: INSIDE }));
    await open();
    expect(screen.getByTestId('info-notice')).toBeTruthy();
    expect(screen.queryByTestId('info-modify')).toBeNull();
  });
});

describe('ADR 0020, section 7: an edited GPX reopens as a route', () => {
  it('shows "GPX modifié le" and the route target of "Modifier"', async () => {
    await insertRoute(
      db,
      sampleCreated({
        origin: 'editedGpx',
        name: 'Sortie importée',
        savedAt: Date.UTC(2026, 10, 9, 12),
      }),
    );
    await open();
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy · GPX modifié le 9 nov/,
    );
    fireEvent.press(screen.getByTestId('info-modify'));
    expect(peekDraftTarget()).toEqual({ kind: 'route', id: 1 });
  });
});
