// Infos of a saved route (ADR 0019, sections 5 and 6; spec C6 and C8). The
// database is a real SQLite in memory; MapLibre, the router, the zone and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  MIGRATIONS,
  migrate,
  RoutesTooNewError,
} from '@/core/routes/migrations';
import { getRoute, insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { peekDraftTarget } from './draftTarget';
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

async function open(): Promise<void> {
  client = new QueryClient();
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
afterEach(() => db.close());

describe('C6: saved track, infos calculated again', () => {
  it('shows the difficulty once the zone has a table, on the saved track', async () => {
    // Saved under v3, which had no difficulty table.
    const saved = sampleCreated({
      zone: { id: 'nancy', version: 3, name: 'Nancy' },
    });
    await insertRoute(db, saved);
    const before = await getRoute(db, 1);
    await open();

    expect(screen.getByTestId('info-title')).toHaveTextContent(saved.name);
    expect(screen.getByTestId('info-difficulty')).toHaveTextContent(
      /S1 \(facile\) sur/,
    );
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy · créé le \d+ \S+ \d{4}$/,
    );
    // The engine measured the saved shape: no route was asked for.
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(mockHeights.mock.calls[0]?.[0]).toEqual([
      [6.18, 48.69],
      [6.185, 48.695],
      [6.19, 48.7],
    ]);
    // Keys: the zone in service (v5) and the version of the saved shape (v5
    // in the sample; see the next test for another).
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(
      keys.some(
        (k) =>
          k[1] === 'height' &&
          k[2] === 'nancy' &&
          k[3] === 5 &&
          k[4] === 'path',
      ),
    ).toBe(true);
    // The track in the base did not change.
    const after = await getRoute(db, 1);
    expect(after).toMatchObject({
      draft: before && 'draft' in before ? before.draft : null,
      legs: before && 'legs' in before ? before.legs : null,
      savedAt: saved.savedAt,
      distanceKm: saved.distanceKm,
    });
  });

  it('tells a saved shape of v3 from a new one of v4 in the key', async () => {
    const saved = sampleCreated();
    saved.legs = [
      { ...(saved.legs[0] as { mode: 'path' }), zoneVersion: 3 } as never,
      saved.legs[1],
    ];
    await insertRoute(db, saved);
    await open();
    const key = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .find((k) => k[1] === 'height' && k[4] === 'path');
    expect(key?.[3]).toBe(5);
    expect(key?.[key.length - 1]).toBe(3);
  });

  it('writes the new ascent and descent for the list, not the track', async () => {
    await insertRoute(db, sampleCreated());
    await open();
    const route = await getRoute(db, 1);
    expect(route).toMatchObject({ ascentM: 60, savedAt: 1_000 });
    expect(route?.figuresAt).toBeGreaterThan(1_000);
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('60 m');
    // The saved detail was read again: a later opening sees the same figure.
    expect(
      (client.getQueryData(['routes', 'detail', 1]) as { ascentM: number })
        .ascentM,
    ).toBe(60);
  });

  it('opens "Modifier" on the same route', async () => {
    await insertRoute(db, sampleCreated());
    await open();
    fireEvent.press(screen.getByTestId('info-modify'));
    expect(peekDraftTarget()).toEqual({ kind: 'route', id: 1 });
    expect(mockPush).toHaveBeenCalledWith('/draft');
  });

  it('goes back to the list', async () => {
    await insertRoute(db, sampleCreated());
    await open();
    fireEvent.press(screen.getByTestId('info-back'));
    expect(mockDismissTo).toHaveBeenCalledWith('/routes');
  });
});

describe('C8: zone deleted', () => {
  it('keeps the route, its saved figures and a clear message, without a crash', async () => {
    await insertRoute(
      db,
      sampleCreated({
        ascentM: 421,
        descentM: 400,
        figuresAt: Date.UTC(2026, 9, 8, 12),
      }),
    );
    mockZone = null;
    mockInstalled = [];
    await open();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Zone Nancy supprimée/,
    );
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy supprimée · créé le/,
    );
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('421 m');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('400 m');
    expect(screen.getByTestId('info-caption')).toHaveTextContent(
      /^Chiffres du dernier calcul, le 8 oct\.$/,
    );
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('info-see-zones'));
    expect(mockDismissTo).toHaveBeenCalledWith('/zones');
  });

  it('shows a dash for figures never known', async () => {
    await insertRoute(db, sampleCreated());
    mockZone = null;
    mockInstalled = [];
    await open();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('—');
    expect(screen.queryByTestId('info-caption')).toBeNull();
  });

  it('a ready zone that is not in service: no calculation, no "Modifier"', async () => {
    await insertRoute(db, sampleCreated());
    mockZone = { ...nancy(1, false), id: 'metz', name: 'Metz' };
    mockInstalled = [nancy(5, true), mockZone];
    await open();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Zone Nancy inactive/,
    );
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(mockHeights).not.toHaveBeenCalled();
  });
});

describe('imported GPX', () => {
  const inZone = {
    zone: { id: 'nancy', version: 5, name: 'Nancy' },
  };

  it('has no "Modifier" and calculates on the thinned track', async () => {
    await insertRoute(db, sampleGpx(inZone));
    await open();
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy · GPX importé le/,
    );
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(mockTerrain).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('info-difficulty')).toBeTruthy();
  });

  it('outside any zone: distance kept, no calculation, no zone in the base', async () => {
    mockZone = null;
    mockInstalled = [];
    await insertRoute(db, sampleGpx());
    await open();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Hors de vos zones/,
    );
    expect(screen.getByTestId('info-distance')).toHaveTextContent('300 m');
    expect(screen.queryByTestId('info-ascent')).toBeNull();
    expect(screen.queryByTestId('info-descent')).toBeNull();
    expect(mockHeights).not.toHaveBeenCalled();
    expect((await getRoute(db, 1))?.zone).toBeNull();
  });

  it('takes the zone in service when its start is inside, and calculates', async () => {
    await insertRoute(db, sampleGpx());
    await open();
    expect((await getRoute(db, 1))?.zone).toEqual({
      id: 'nancy',
      version: 5,
      name: 'Nancy',
    });
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy/,
    );
  });

  it('leaves the zone: the map, but no D+, terrain or difficulty', async () => {
    await insertRoute(
      db,
      sampleGpx({
        ...inZone,
        elevations: null,
        track: [
          [6.2, 48.6],
          [7.5, 48.6],
        ],
      }),
    );
    await open();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Ce tracé sort de la zone Nancy/,
    );
    expect(mockHeights).not.toHaveBeenCalled();
    expect(screen.queryByTestId('info-see-zones')).toBeNull();
  });
});

describe('other states', () => {
  it('an unknown route says so', async () => {
    mockId = '42';
    await open();
    expect(screen.getByTestId('saved-message-title')).toHaveTextContent(
      "Cet itinéraire n'existe plus.",
    );
  });

  it('a database written by a newer app: the message, nothing written', async () => {
    mockDb = Promise.reject(new RoutesTooNewError());
    mockDb.catch(() => undefined);
    await open();
    expect(screen.getByTestId('saved-message')).toHaveTextContent(
      'Mettez à jour RutaPulse pour retrouver vos itinéraires.',
    );
  });

  it('an unreadable route keeps its name and does not crash', async () => {
    await insertRoute(db, sampleCreated({ name: 'Cassé' }));
    await db.run("UPDATE routes SET draft = 'not json'");
    await open();
    expect(screen.getByTestId('saved-message-title')).toHaveTextContent(
      'Cassé',
    );
    expect(screen.getByTestId('saved-message')).toHaveTextContent(
      /ne peut pas être lu/,
    );
  });
});
