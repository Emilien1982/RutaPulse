import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { parseCatalogue, type Zone } from '@/core/zones/catalogue';
import catalogueV4 from '@/core/zones/fixtures/catalogueV4Testeur.json';

import { DraftSessionContext } from './DraftSession';
import { createDraftStore } from './draftStore';
import { RouteInfoScreen } from './RouteInfoScreen';

const mockTerrain = jest.fn();
const mockReadText = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: { children: ReactNode }) => <View>{props.children}</View>,
    Camera: () => null,
    Layer: () => null,
    GeoJSONSource: () => null,
  };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: async () => ({
    ok: true,
    shape: [
      [6.1, 48.66],
      [6.14, 48.68],
    ],
    distanceKm: 3,
    durationS: 900,
  }),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: async () => ({
    ok: true,
    profile: [
      [0, 100],
      [3000, 130],
    ],
  }),
  computeTerrain: (...args: unknown[]) => mockTerrain(...args),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ readText: mockReadText }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

// Zone of the real published catalogue v4 (no difficulty.json in its files).
const noTable: Zone = parseCatalogue(catalogueV4).zones[0] as Zone;
const withTable: Zone = {
  ...noTable,
  files: [
    ...noTable.files,
    { path: 'difficulty.json', bytes: 1, sha256: 'x', url: 'https://x/y' },
  ],
};
const lists = (byLevel: Record<number, number[]>) =>
  JSON.stringify({
    formatVersion: 1,
    waysByLevel: [0, 1, 2, 3, 4, 5, 6].map((l) => byLevel[l] ?? []),
  });
const edges = (...parts: [number, number | undefined][]) => ({
  ok: true,
  edges: parts.map(([lengthKm, wayId]) => ({
    use: 'path',
    density: 1,
    lengthKm,
    ...(wayId === undefined ? {} : { wayId }),
  })),
});

async function show(zone: Zone) {
  const session = createDraftStore();
  session.dispatch({ type: 'chooseMode', mode: 'path' });
  session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
  session.dispatch({ type: 'chooseMode', mode: 'path' });
  session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
  const client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <DraftSessionContext.Provider value={{ ...session, zone }}>
        <RouteInfoScreen />
      </DraftSessionContext.Provider>
    </QueryClientProvider>,
  );
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
const line = () => screen.getByTestId('info-difficulty');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('C7: the "Difficulté" line', () => {
  it('gives the example of the spec: S1 4 %, unknown 96 %', async () => {
    mockReadText.mockResolvedValue(lists({ 1: [10] }));
    mockTerrain.mockResolvedValue(edges([0.4, 10], [9.6, 11]));
    await show(withTable);
    expect(line()).toHaveTextContent(
      'Difficulté : S1 (facile) sur 4 % ; inconnue sur 96 %, la carte la donne rarement.',
    );
  });

  it('writes the seven words of the scale', async () => {
    // Lengths 7, 6, 5, 4, 3, 2, 1 km for S0 to S6: 25, 21, 18, 14, 11, 7, 4 %.
    mockReadText.mockResolvedValue(
      lists({ 0: [1], 1: [2], 2: [3], 3: [4], 4: [5], 5: [6], 6: [7] }),
    );
    mockTerrain.mockResolvedValue(
      edges([7, 1], [6, 2], [5, 3], [4, 4], [3, 5], [2, 6], [1, 7]),
    );
    await show(withTable);
    expect(line()).toHaveTextContent(
      'Difficulté : S0 (très facile) sur 25 % ; S1 (facile) sur 21 % ; ' +
        'S2 (moyen) sur 18 % ; S3 (difficile) sur 14 % ; ' +
        'S4 (très difficile) sur 11 % ; S5 (extrême) sur 7 % ; ' +
        'S6 (non roulable) sur 4 %.',
    );
  });

  it('orders from the most frequent to the least, then unknown', async () => {
    mockReadText.mockResolvedValue(lists({ 1: [10], 3: [30] }));
    // S1 1 km, S3 5 km, unknown 6 km (the longest, still last).
    mockTerrain.mockResolvedValue(edges([1, 10], [5, 30], [6, 99]));
    await show(withTable);
    expect(line()).toHaveTextContent(
      'Difficulté : S3 (difficile) sur 42 % ; S1 (facile) sur 8 % ; inconnue sur 50 %, la carte la donne rarement.',
    );
  });

  it('writes "moins de 1 %" for a tiny share', async () => {
    mockReadText.mockResolvedValue(lists({ 2: [20] }));
    mockTerrain.mockResolvedValue(edges([0.01, 20], [9.99, 99]));
    await show(withTable);
    expect(line()).toHaveTextContent(
      'Difficulté : S2 (moyen) sur moins de 1 % ; inconnue sur 100 %, la carte la donne rarement.',
    );
  });

  it('writes "inconnue sur moins de 1 %" for a tiny unknown share', async () => {
    mockReadText.mockResolvedValue(lists({ 2: [20] }));
    mockTerrain.mockResolvedValue(edges([9.99, 20], [0.01, 99]));
    await show(withTable);
    expect(line()).toHaveTextContent(
      /S2 \(moyen\) sur 100\s%\s?;\s?inconnue sur moins de 1\s%/,
    );
  });

  it('has no "inconnue" part when everything is known', async () => {
    mockReadText.mockResolvedValue(lists({ 1: [10] }));
    mockTerrain.mockResolvedValue(edges([3, 10]));
    await show(withTable);
    expect(line()).toHaveTextContent('Difficulté : S1 (facile) sur 100 %.');
    expect(screen.queryByText(/inconnue/)).toBeNull();
  });

  it('gives the single sentence when no way is known', async () => {
    mockReadText.mockResolvedValue(lists({ 1: [10] }));
    mockTerrain.mockResolvedValue(edges([3, 99], [2, undefined]));
    await show(withTable);
    expect(line()).toHaveTextContent(
      'Difficulté inconnue, la carte la donne rarement.',
    );
    expect(screen.queryByText(/Difficulté :/)).toBeNull();
  });

  it('says "Difficulté indisponible" when the terrain is missing', async () => {
    mockReadText.mockResolvedValue(lists({ 1: [10] }));
    mockTerrain.mockResolvedValue({ ok: false, error: 'failed' });
    await show(withTable);
    expect(screen.getByText('Difficulté indisponible')).toBeTruthy();
  });
});

describe('C8: a zone without table (published catalogue v4 fixture)', () => {
  it('has no difficulty.json in the fixture', () => {
    expect(noTable.files.some((f) => f.path === 'difficulty.json')).toBe(false);
  });

  it('says unknown, reads nothing from the disk, shows no error', async () => {
    mockTerrain.mockResolvedValue(edges([0.4, 10], [9.6, 11]));
    await show(noTable);
    expect(line()).toHaveTextContent(
      'Difficulté inconnue, la carte la donne rarement.',
    );
    expect(mockReadText).not.toHaveBeenCalled();
    expect(screen.queryByTestId('info-difficulty-missing')).toBeNull();
  });

  it('an unreadable or corrupt table also gives unknown, no error', async () => {
    mockReadText.mockRejectedValue(new Error('disk'));
    mockTerrain.mockResolvedValue(edges([1, 10]));
    await show(withTable);
    expect(line()).toHaveTextContent(
      'Difficulté inconnue, la carte la donne rarement.',
    );
  });
});
