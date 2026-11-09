// Tester's tests of task T4 (phase 6): the Infos screen of a saved route,
// /route/[id] (spec C6, C8, choice 6, question 1; ADR 0019 sections 5 and 6,
// answers 6 and 8; mockup 40, states 7b and 8a). Written from the spec, the
// ADR and the mockup. The database is a real SQLite in memory; MapLibre, the
// router, the zones and the engine are faked ("fake zone"). No simulator.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  MIGRATIONS,
  migrate,
  RoutesTooNewError,
} from '@/core/routes/migrations';
import { getRoute, insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { peekDraftTarget, setDraftTarget } from './draftTarget';
import { SavedRouteInfoScreen } from './SavedRouteInfoScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
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
    navigate: mockNavigate,
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

// A fake zone "Nancy": version 3 has no difficulty table, version 5 has one.
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
// Way 10 is level 1 (S1, facile); no other way is in the table.
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

// One path leg of 30 m of climb (100 m -> 130 m); nothing else.
const A: [number, number] = [6.18, 48.69];
const B: [number, number] = [6.19, 48.7];
const SHAPE: [number, number][] = [A, [6.1851, 48.6949], B];
const pathRoute = (patch: Parameters<typeof sampleCreated>[0] = {}) =>
  sampleCreated({
    draft: {
      points: [
        { id: 1, lon: A[0], lat: A[1] },
        { id: 2, lon: B[0], lat: B[1] },
      ],
      modes: ['path'],
    },
    legs: [
      {
        mode: 'path',
        zoneVersion: 3,
        distanceKm: 1.5,
        durationS: 450,
        shape: SHAPE,
      },
    ],
    distanceKm: 1.5,
    durationS: 450,
    ...patch,
  });

// The whole row, but for the figures that Infos may write (choice 6).
async function trackColumns() {
  const row = await db.first<Record<string, unknown>>(
    'SELECT * FROM routes WHERE id = 1',
  );
  const { ascent_m, descent_m, figures_at, ...rest } = row ?? {};
  void ascent_m;
  void descent_m;
  void figures_at;
  return rest;
}

beforeEach(async () => {
  jest.clearAllMocks();
  setDraftTarget(null);
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

describe('C6: saved track, infos calculated again (fake zone)', () => {
  it('a route saved under v3 (no table) shows the difficulty once v5 (with a table) is in service', async () => {
    await insertRoute(
      db,
      pathRoute({ zone: { id: 'nancy', version: 3, name: 'Nancy' } }),
    );
    await open();
    // Half of the km is way 10 (S1), half is in no table: 50 % each.
    expect(screen.getByTestId('info-difficulty')).toHaveTextContent(
      /S1 \(facile\) sur 50.%/,
    );
  });

  it('with a zone in service that still has no table, no level is shown', async () => {
    mockZone = nancy(3, false);
    mockInstalled = [mockZone];
    await insertRoute(
      db,
      pathRoute({ zone: { id: 'nancy', version: 3, name: 'Nancy' } }),
    );
    await open();
    expect(screen.getByTestId('info-difficulty')).not.toHaveTextContent(/S1/);
  });

  it('opens with the saved name as title and "créé le" under it', async () => {
    await insertRoute(db, pathRoute({ name: 'Boucle du Bois' }));
    await open();
    expect(screen.getByTestId('info-title')).toHaveTextContent(
      /Boucle du Bois/,
    );
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy · créé le \d{1,2} \S+ \d{4}$/,
    );
  });

  it('asks for no track calculation, and the saved track is identical in the base', async () => {
    await insertRoute(db, pathRoute());
    const before = await trackColumns();
    await open();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    // The engine measured the saved shape, point for point.
    expect(mockHeights.mock.calls[0]?.[0]).toEqual(SHAPE);
    expect(await trackColumns()).toEqual(before);
  });

  it('the figures of the list are updated, and the order of the list does not change', async () => {
    await insertRoute(db, pathRoute({ name: 'Ancien', savedAt: 1_000 }));
    mockId = '1';
    await insertRoute(db, sampleCreated({ name: 'Récent', savedAt: 9_000 }));
    const before = await listRoutes(db);
    expect(before.map((r) => r.name)).toEqual(['Récent', 'Ancien']);
    expect(before[1]?.ascentM).toBeNull();

    await open();

    const after = await listRoutes(db);
    // Same order although "Ancien" was opened (no new save date).
    expect(after.map((r) => r.name)).toEqual(['Récent', 'Ancien']);
    const old = after.find((r) => r.name === 'Ancien');
    expect(old?.ascentM).toBe(30);
    expect(old?.descentM).toBe(0);
    expect(old?.figuresAt).toBeGreaterThan(1_000);
    // The distance, the duration and the date of saving are kept.
    expect(old).toMatchObject({
      distanceKm: 1.5,
      durationS: 450,
      savedAt: 1_000,
    });
    expect(screen.getByTestId('info-ascent')).toHaveTextContent(/30\s*m/);
  });

  it('shows "Modifier" for a created route on its usable zone, and it opens the creation on this route', async () => {
    await insertRoute(db, pathRoute());
    await open();
    await fireEvent.press(screen.getByTestId('info-modify'));
    expect(peekDraftTarget()).toEqual({ kind: 'route', id: 1 });
    expect(mockPush).toHaveBeenCalledWith('/draft');
  });

  it('"Retour" goes to the list with dismissTo', async () => {
    await insertRoute(db, pathRoute());
    await open();
    await fireEvent.press(screen.getByTestId('info-back'));
    expect(mockDismissTo).toHaveBeenCalledWith('/routes');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('C8 and mockup 7b: zone deleted', () => {
  const figuresAt = Date.UTC(2026, 9, 8, 12);
  beforeEach(async () => {
    await insertRoute(
      db,
      pathRoute({
        name: 'Tour du lac',
        ascentM: 548,
        descentM: 548,
        figuresAt,
      }),
    );
    mockZone = null;
    mockInstalled = [];
  });

  it('opens, keeps the saved figures dated, says what is missing, no crash', async () => {
    await open();
    expect(screen.getByTestId('info-title')).toHaveTextContent(/Tour du lac/);
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy supprimée · créé le/,
    );
    expect(screen.getByTestId('info-distance')).toHaveTextContent(/^1,5\s*km/);
    expect(screen.getByTestId('info-ascent')).toHaveTextContent(/548\s*m/);
    expect(screen.getByTestId('info-descent')).toHaveTextContent(/548\s*m/);
    expect(screen.getByTestId('info-caption')).toHaveTextContent(
      'Chiffres du dernier calcul, le 8 oct.',
    );
    const notice = screen.getByTestId('info-notice');
    expect(notice).toHaveTextContent(/Zone Nancy supprimée/);
    expect(notice).toHaveTextContent(/carte, profil, terrain et difficulté/);
    expect(notice).toHaveTextContent(/Téléchargez la zone à nouveau/);
    expect(notice).toHaveTextContent(/modifier l'itinéraire/);
  });

  it('has no "Modifier" and calculates nothing', async () => {
    await open();
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
  });

  it('"Voir les zones" and "Retour" use dismissTo', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('info-see-zones'));
    expect(mockDismissTo).toHaveBeenLastCalledWith('/zones');
    await fireEvent.press(screen.getByTestId('info-back'));
    expect(mockDismissTo).toHaveBeenLastCalledWith('/routes');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('leaves the base untouched (figures and track)', async () => {
    const before = await db.first('SELECT * FROM routes WHERE id = 1');
    await open();
    expect(await db.first('SELECT * FROM routes WHERE id = 1')).toEqual(before);
  });

  it('a route whose figures were never known shows dashes, not zeros', async () => {
    await db.run(
      'UPDATE routes SET ascent_m = NULL, descent_m = NULL, figures_at = NULL',
    );
    await open();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('—');
  });

  it('a GPX route of a deleted zone: same message, no "Modifier"', async () => {
    await insertRoute(
      db,
      sampleGpx({ zone: { id: 'nancy', version: 5, name: 'Nancy' } }),
    );
    mockId = '2';
    await open();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Zone Nancy supprimée/,
    );
    expect(screen.queryByTestId('info-modify')).toBeNull();
  });
});

describe('Question 1 and answer 6: imported GPX', () => {
  it('shows "Modifier", in the zone', async () => {
    await insertRoute(
      db,
      sampleGpx({ zone: { id: 'nancy', version: 5, name: 'Nancy' } }),
    );
    await open();
    expect(screen.getByTestId('info-modify')).toBeTruthy();
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /^Zone Nancy · GPX importé le/,
    );
  });

  it('outside any zone: distance and duration only, no "Modifier", no calculation', async () => {
    mockZone = null;
    mockInstalled = [];
    // Answer 6: 10 km/h, so 10 km take 1 h (3600 s).
    await insertRoute(
      db,
      sampleGpx({
        zone: null,
        distanceKm: 10,
        durationS: 3600,
        ascentM: null,
        descentM: null,
        figuresAt: null,
      }),
    );
    await open();
    expect(screen.getByTestId('info-distance')).toHaveTextContent(/^10,0\s*km/);
    expect(screen.getByTestId('info-duration')).toHaveTextContent(/1\s*h/);
    expect(screen.queryByTestId('info-ascent')).toBeNull();
    expect(screen.queryByTestId('info-descent')).toBeNull();
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(screen.getByTestId('info-notice')).toHaveTextContent(
      /Hors de vos zones/,
    );
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });
});

describe('Database too new, unknown route', () => {
  it('says to update the app, writes nothing, does not crash, and goes back with dismissTo', async () => {
    mockDb = Promise.reject(new RoutesTooNewError());
    mockDb.catch(() => undefined);
    await open();
    expect(screen.getByTestId('saved-message-title')).toHaveTextContent(
      'Itinéraires indisponibles',
    );
    expect(screen.getByTestId('saved-message')).toHaveTextContent(
      'Mettez à jour RutaPulse pour retrouver vos itinéraires.',
    );
    expect(screen.queryByTestId('info-modify')).toBeNull();
    await fireEvent.press(screen.getByTestId('info-back'));
    expect(mockDismissTo).toHaveBeenCalledWith('/routes');
  });

  it('an unknown number says the route does not exist', async () => {
    mockId = '999';
    await open();
    expect(screen.getByTestId('saved-message-title')).toHaveTextContent(
      "Cet itinéraire n'existe plus.",
    );
  });

  it('a number that is not a number does not crash', async () => {
    mockId = 'abc';
    await open();
    expect(screen.getByTestId('saved-message-title')).toHaveTextContent(
      "Cet itinéraire n'existe plus.",
    );
  });

  it('a route read in another zone in service: no calculation, no "Modifier"', async () => {
    await insertRoute(db, pathRoute());
    mockZone = { ...nancy(1, false), id: 'metz', name: 'Metz' };
    mockInstalled = [nancy(5, true), mockZone];
    await open();
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(await getRoute(db, 1)).toMatchObject({ readable: true });
  });
});
