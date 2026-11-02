import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Zone } from '@/core/zones/catalogue';

import { DraftSessionContext } from './DraftSession';
import { createDraftStore } from './draftStore';
import { RouteInfoScreen } from './RouteInfoScreen';

// MapLibre, the router, the disk and the engine are replaced.
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockBack = jest.fn();
const mockShowAttribution = jest.fn();
let mockMapProps: Record<string, unknown> = {};
let mockCameraProps: Record<string, any> = {};
const mockSources: Record<string, any> = {};

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (
      props: Record<string, unknown> & {
        children: ReactNode;
        ref?: React.Ref<unknown>;
      },
    ) => {
      mockMapProps = props;
      useImperativeHandle(props.ref, () => ({
        showAttribution: mockShowAttribution,
      }));
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: Record<string, any>) => {
      mockCameraProps = props;
      return null;
    },
    Layer: () => null,
    GeoJSONSource: (props: { id: string; data: unknown }) => {
      mockSources[props.id] = props.data;
      return null;
    },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
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
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const zone: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 3,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [],
};

const P1 = { lon: 6.1, lat: 48.66 };
const P2 = { lon: 6.14, lat: 48.68 };
const P3 = { lon: 6.18, lat: 48.7 };

const route = {
  ok: true,
  shape: [
    [6.1, 48.66],
    [6.14, 48.68],
  ],
  distanceKm: 3,
  durationS: 900,
};
// D+ 35 m (100 -> 110, then 105 -> 130), D- 5 m, from 100 to 130 m.
const heights = {
  ok: true,
  profile: [
    [0, 100],
    [1000, 110],
    [2000, 105],
    [3000, 130],
  ],
};
// 4 km: road 1, track 1, trail 2.
const terrain = {
  ok: true,
  edges: [
    { use: 'road', density: 2, lengthKm: 1 },
    { use: 'track', density: 1, lengthKm: 1 },
    { use: 'path', density: 1, lengthKm: 2 },
  ],
};
const failed = { ok: false, error: 'failed' };

function renderInfos(
  points: { lon: number; lat: number; hand?: boolean }[],
  options: { client?: QueryClient } = {},
) {
  const session = createDraftStore();
  for (const { hand, ...p } of points) {
    // The mode chosen before a point is the mode of the leg that ends on it.
    session.dispatch({ type: 'chooseMode', mode: hand ? 'hand' : 'path' });
    session.dispatch({ type: 'add', ...p });
  }
  const client = options.client ?? new QueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <DraftSessionContext.Provider value={{ ...session, zone }}>
        <RouteInfoScreen />
      </DraftSessionContext.Provider>
    </QueryClientProvider>,
  );
}

async function renderReady(...args: Parameters<typeof renderInfos>) {
  await renderInfos(...args);
  // The route, then the altitudes and the terrain: one answer after another.
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

beforeEach(() => {
  jest.clearAllMocks();
  mockComputeRoute.mockResolvedValue(route);
  mockHeights.mockResolvedValue(heights);
  mockTerrain.mockResolvedValue(terrain);
});

describe('Infos screen (mockup 20)', () => {
  it('shows the header "Nouvel itinéraire"', async () => {
    await renderReady([P1, P2]);
    expect(
      screen.getByRole('header', { name: 'Nouvel itinéraire' }),
    ).toBeTruthy();
  });

  it('shows distance, duration, ascent and descent', async () => {
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
    expect(screen.getByTestId('info-duration')).toHaveTextContent('15 min');
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('35 m');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('5 m');
    expect(screen.getByText('Montée (D+)')).toBeTruthy();
    expect(screen.getByText('Descente (D−)')).toBeTruthy();
  });

  it('shows the lowest and the highest altitude, and the profile', async () => {
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-range')).toHaveTextContent(
      'de 100 à 130 m',
    );
    expect(screen.getByTestId('info-profile')).toBeTruthy();
  });

  it('draws the terrain band under the profile and the legend', async () => {
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-band-road')).toBeTruthy();
    expect(screen.getByTestId('info-band-track')).toBeTruthy();
    expect(screen.getByTestId('info-band-trail')).toBeTruthy();
    expect(screen.getByText('Route 25 %')).toBeTruthy();
    expect(screen.getByText('Piste 25 %')).toBeTruthy();
    expect(screen.getByText('Sentier 50 %')).toBeTruthy();
    expect(screen.queryByText(/À la main/)).toBeNull();
  });

  it('adds the part "À la main" when a leg is drawn by hand', async () => {
    await renderReady([P1, P2, { ...P3, hand: true }]);
    expect(screen.getAllByText(/À la main/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('info-band-hand')).toBeTruthy();
  });

  it('has no "Démarrer le suivi" and no "Difficulté"', async () => {
    await renderReady([P1, P2]);
    expect(screen.queryByText(/Démarrer le suivi/)).toBeNull();
    expect(screen.queryByText(/Difficulté/)).toBeNull();
  });

  it('"Modifier" goes back', async () => {
    await renderReady([P1, P2]);
    await fireEvent.press(screen.getByRole('button', { name: /Modifier/ }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('frames the whole route on a map that does not move', async () => {
    await renderReady([P1, P2, P3]);
    expect(screen.getByTestId('info-map')).toBeTruthy();
    expect(mockMapProps.dragPan).toBe(false);
    expect(mockMapProps.touchZoom).toBe(false);
    const [west, south, east, north] = mockCameraProps.initialViewState.bounds;
    expect(west).toBeLessThan(6.1);
    expect(east).toBeGreaterThan(6.18);
    expect(south).toBeLessThan(48.66);
    expect(north).toBeGreaterThan(48.7);
    expect(
      mockSources['info-ends'].features.map((f: any) => f.properties.role),
    ).toEqual(['start', 'end']);
  });

  it('the "i" button opens the attributions', async () => {
    await renderReady([P1, P2]);
    expect(screen.getByText('© OpenStreetMap')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('info-attribution-button'));
    expect(mockShowAttribution).toHaveBeenCalledTimes(1);
  });
});

describe('Infos screen: missing and pending data (C10)', () => {
  it('says "Altitudes indisponibles" and keeps the rest', async () => {
    mockHeights.mockResolvedValue(failed);
    await renderReady([P1, P2]);
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect(screen.queryByTestId('info-ascent')).toBeNull();
    expect(screen.queryByTestId('info-descent')).toBeNull();
    expect(screen.queryByTestId('info-profile')).toBeNull();
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
    expect(screen.getByTestId('info-duration')).toBeTruthy();
    expect(screen.getByText('Route 25 %')).toBeTruthy();
    expect(screen.getByTestId('info-map')).toBeTruthy();
  });

  it('says "Terrain indisponible" and keeps the rest', async () => {
    mockTerrain.mockResolvedValue(failed);
    await renderReady([P1, P2]);
    expect(screen.getByText('Terrain indisponible')).toBeTruthy();
    expect(screen.queryByTestId('info-legend')).toBeNull();
    expect(screen.queryByTestId('info-band-road')).toBeNull();
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('35 m');
    expect(screen.getByTestId('info-profile')).toBeTruthy();
    expect(screen.getByTestId('info-distance')).toBeTruthy();
  });

  it('says both when altitudes and terrain are missing', async () => {
    mockHeights.mockResolvedValue(failed);
    mockTerrain.mockResolvedValue(failed);
    await renderReady([P1, P2]);
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect(screen.getByText('Terrain indisponible')).toBeTruthy();
    expect(screen.getByTestId('info-distance')).toBeTruthy();
  });

  it('shows "…" while the figures are computed', async () => {
    mockHeights.mockReturnValue(new Promise(() => {}));
    mockTerrain.mockReturnValue(new Promise(() => {}));
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('…');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('…');
    expect(screen.getByTestId('info-terrain-pending')).toHaveTextContent('…');
    expect(screen.getByTestId('info-distance')).toHaveTextContent('3,0 km');
  });

  it('does not crash without any point', async () => {
    await renderReady([]);
    expect(
      screen.getByRole('header', { name: 'Nouvel itinéraire' }),
    ).toBeTruthy();
  });
});

describe('Infos screen computes nothing', () => {
  it('reads everything from the cache: no native call on opening', async () => {
    const client = new QueryClient();
    const at = (kind: string, mode: string) => [
      'routing',
      kind,
      'nancy',
      3,
      mode,
      P1.lon,
      P1.lat,
      P2.lon,
      P2.lat,
    ];
    client.setQueryData(at('leg', 'path'), route);
    client.setQueryData(at('height', 'path'), heights.profile);
    client.setQueryData(at('terrain', 'path'), terrain.edges);
    await renderReady([P1, P2], { client });
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('35 m');
    expect(screen.getByText('Sentier 50 %')).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(mockTerrain).not.toHaveBeenCalled();
  });

  it('does not ask again for altitudes that failed (read only)', async () => {
    const client = new QueryClient();
    const key = [
      'routing',
      'height',
      'nancy',
      3,
      'path',
      P1.lon,
      P1.lat,
      P2.lon,
      P2.lat,
    ];
    client.setQueryData(
      ['routing', 'leg', 'nancy', 3, 'path', P1.lon, P1.lat, P2.lon, P2.lat],
      route,
    );
    await client
      .fetchQuery({
        queryKey: key,
        queryFn: () => Promise.reject(new Error('failed')),
        retry: false,
      })
      .catch(() => {});
    await renderReady([P1, P2], { client });
    expect(screen.getByText('Altitudes indisponibles')).toBeTruthy();
    expect(mockHeights).not.toHaveBeenCalled();
  });
});
