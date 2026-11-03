import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Zone } from '@/core/zones/catalogue';

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

const base: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 5,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [],
};
const withTable: Zone = {
  ...base,
  files: [
    { path: 'difficulty.json', bytes: 1, sha256: 'x', url: 'https://x/y' },
  ],
};
const TABLE = JSON.stringify({
  formatVersion: 1,
  waysByLevel: [[], [10], [], [], [], [], []],
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
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTerrain.mockResolvedValue({
    ok: true,
    edges: [
      { use: 'path', density: 1, lengthKm: 0.4, wayId: 10 },
      { use: 'path', density: 1, lengthKm: 9.6, wayId: 11 },
    ],
  });
});

describe('Difficulty line (mockup 20)', () => {
  it('shows the levels, then unknown', async () => {
    mockReadText.mockResolvedValue(TABLE);
    const client = await show(withTable);
    expect(screen.getByTestId('info-difficulty')).toHaveTextContent(
      'Difficulté : S1 (facile) sur 4 % ; inconnue sur 96 %, la carte la donne rarement.',
    );
    expect(mockReadText).toHaveBeenCalledWith('zones/nancy/v5/difficulty.json');
    expect(
      client
        .getQueryCache()
        .find({ queryKey: ['zones', 'difficulty', 'nancy', 5] }),
    ).toBeDefined();
  });

  it('writes "moins de 1 %"', async () => {
    mockReadText.mockResolvedValue(TABLE);
    mockTerrain.mockResolvedValue({
      ok: true,
      edges: [
        { use: 'path', density: 1, lengthKm: 0.01, wayId: 10 },
        { use: 'path', density: 1, lengthKm: 9.99, wayId: 11 },
      ],
    });
    await show(withTable);
    expect(screen.getByTestId('info-difficulty')).toHaveTextContent(
      /S1 \(facile\) sur moins de 1\s% ; inconnue sur 100\s%/,
    );
  });

  it('C8: a zone without a table reads nothing and says unknown', async () => {
    await show(base);
    expect(mockReadText).not.toHaveBeenCalled();
    expect(screen.getByTestId('info-difficulty')).toHaveTextContent(
      'Difficulté inconnue, la carte la donne rarement.',
    );
  });

  it('says unknown when the file cannot be read', async () => {
    mockReadText.mockRejectedValue(new Error('disk'));
    await show(withTable);
    expect(screen.getByTestId('info-difficulty')).toHaveTextContent(
      'Difficulté inconnue, la carte la donne rarement.',
    );
  });

  it('says "indisponible" when the terrain is missing', async () => {
    mockTerrain.mockResolvedValue({ ok: false, error: 'failed' });
    await show(base);
    expect(screen.getByTestId('info-difficulty-missing')).toHaveTextContent(
      'Difficulté indisponible',
    );
  });
});
