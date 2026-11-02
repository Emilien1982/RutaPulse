import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Zone } from '@/core/zones/catalogue';

import { DraftSessionContext } from './DraftSession';
import { createDraftStore } from './draftStore';
import { DraftScreen } from './DraftScreen';

// MapLibre, the router, the disk and the engine are replaced.
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockShowAttribution = jest.fn();
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
      useImperativeHandle(props.ref, () => ({
        showAttribution: mockShowAttribution,
      }));
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: Record<string, any>) => {
      useImperativeHandle(props.ref, () => ({ easeTo: jest.fn() }));
      return null;
    },
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    ViewAnnotation: (props: { children: ReactNode }) => <>{props.children}</>,
    Layer: () => null,
    GeoJSONSource: (props: { id: string; data: unknown }) => {
      mockSources[props.id] = props.data;
      return null;
    },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: () => undefined,
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
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

async function renderDraft(points: { lon: number; lat: number }[]) {
  const session = createDraftStore();
  for (const p of points) session.dispatch({ type: 'add', ...p });
  const client = new QueryClient();
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <DraftSessionContext.Provider value={{ ...session, zone }}>
        <DraftScreen />
      </DraftSessionContext.Provider>
    </QueryClientProvider>,
  );
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

describe('The summary opens the Infos screen', () => {
  it('opens /draft/infos with 2 points and known figures', async () => {
    await renderDraft([P1, P2]);
    await fireEvent.press(screen.getByTestId('route-open-infos'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/draft/infos');
  });

  it('is not touchable under 2 points', async () => {
    await renderDraft([P1]);
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('is not touchable while the figures are computed', async () => {
    mockHeights.mockReturnValue(new Promise(() => {}));
    await renderDraft([P1, P2]);
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
  });

  it('is not touchable with an error sheet', async () => {
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'noRoute' });
    await renderDraft([P1, P2]);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
  });

  it('is touchable even when the altitudes are missing', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await renderDraft([P1, P2]);
    expect(screen.getByTestId('route-open-infos')).toBeTruthy();
  });

  it('a quick double touch opens Infos once', async () => {
    await renderDraft([P1, P2]);
    await fireEvent.press(screen.getByTestId('route-open-infos'));
    await fireEvent.press(screen.getByTestId('route-open-infos'));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});

describe('The creation asks again for what failed', () => {
  it('computes the altitudes again when their key comes back in error', async () => {
    const client = new QueryClient();
    clients.push(client);
    await client
      .fetchQuery({
        queryKey: [
          'routing',
          'height',
          'nancy',
          3,
          'path',
          P1.lon,
          P1.lat,
          P2.lon,
          P2.lat,
        ],
        queryFn: () => Promise.reject(new Error('failed')),
        retry: false,
      })
      .catch(() => {});
    const session = createDraftStore();
    for (const p of [P1, P2]) session.dispatch({ type: 'add', ...p });
    await render(
      <QueryClientProvider client={client}>
        <DraftSessionContext.Provider value={{ ...session, zone }}>
          <DraftScreen />
        </DraftSessionContext.Provider>
      </QueryClientProvider>,
    );
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }
    expect(mockHeights).toHaveBeenCalled();
  });
});
