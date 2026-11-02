import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import * as RN from 'react-native';
import { StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import type { Zone } from '@/core/zones/catalogue';

import { DraftSessionContext } from './DraftSession';
import { createDraftStore } from './draftStore';
import { RouteInfoScreen } from './RouteInfoScreen';
import { RouteSummarySheet } from './RouteSheets';
import { routeBounds } from './infoGeometry';
import { buildMapStyle } from './mapStyle';

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
    Camera: (props: Record<string, unknown>) => {
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

const flat = (style: unknown) => StyleSheet.flatten(style as never);

describe('T9 B1: chevron in the summary', () => {
  const sheet = (onOpen?: () => void) =>
    render(
      <RouteSummarySheet
        distanceKm={25.1}
        durationS={5700}
        ascentM={421}
        onOpen={onOpen}
      />,
    );

  it('is inside the same Pressable as the figures (one target)', async () => {
    const onOpen = jest.fn();
    await sheet(onOpen);
    const pressable = screen.getByTestId('route-open-infos');
    expect(within(pressable).getByTestId('route-figures')).toBeTruthy();
    expect(pressable.props.accessibilityLabel).toMatch(
      /^Infos de l'itinéraire, /,
    );
    expect(pressable.props.accessibilityLabel).toMatch(/25,1/);
    await fireEvent.press(pressable);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is 48 round, cream light, and not faded when it opens', async () => {
    await sheet(() => {});
    const pressable = screen.getByTestId('route-open-infos');
    const chevron = pressable.children
      .map((c) => (typeof c === 'string' ? null : c))
      .filter(Boolean)
      .pop() as any;
    const style = flat(chevron.props.style);
    expect(style.width).toBe(48);
    expect(style.height).toBe(48);
    expect(style.opacity).toBeUndefined();
  });

  it('shows a cream light background of radius 18 while pressed', async () => {
    await sheet(() => {});
    const pressable = screen.getByTestId('route-open-infos');
    expect(flat(pressable.props.style).borderRadius).toBe(18);
    expect(flat(pressable.props.style).backgroundColor).toBeUndefined();
    await act(async () => {
      pressable.props.onResponderGrant({
        persist: () => {},
        currentTarget: 1,
        nativeEvent: { touches: [], changedTouches: [], timestamp: 0 },
      });
    });
    expect(
      flat(screen.getByTestId('route-open-infos').props.style).backgroundColor,
    ).toBe('#FBF1DA');
  });

  it('stays in place at 40 % when the summary cannot open', async () => {
    await sheet(undefined);
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
    const off = screen.getByTestId('route-open-infos-off', {
      includeHiddenElements: true,
    });
    expect(flat(off.props.style).opacity).toBe(0.4);
    expect(flat(off.props.style).width).toBe(48);
  });

  it('has the same row box open or not (nothing moves)', async () => {
    await sheet(() => {});
    const open = flat(screen.getByTestId('route-open-infos').props.style);
    expect(open).toEqual({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 18,
      overflow: 'hidden',
    });
  });

  it('the closed row has that same box', async () => {
    await sheet(undefined);
    const off = screen.getByTestId('route-open-infos-off', {
      includeHiddenElements: true,
    });
    expect(flat(off.parent?.props.style)).toEqual({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 18,
      overflow: 'hidden',
    });
  });
});

describe('T9 summary: normal and compact modes', () => {
  const sheet = () =>
    render(
      <RouteSummarySheet
        distanceKm={125.4}
        durationS={38700}
        ascentM={1250}
        onOpen={() => {}}
      />,
    );
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(RN.Dimensions, 'get');
  });
  const at = (width: number, fontScale = 1) =>
    spy.mockReturnValue({ width, height: 800, scale: 1, fontScale });
  afterEach(() => spy.mockRestore());

  it('keeps the usual look at 390 dp (the threshold itself)', async () => {
    at(390);
    await sheet();
    const figure = screen.getByTestId('route-distance');
    expect(flat(figure.props.style).fontSize).toBe(28);
    expect(flat(screen.getByTestId('route-figures').props.style).gap).toBe(16);
    expect(screen.getByText('Montée (D+)')).toBeTruthy();
    expect(screen.getByText('Durée estimée')).toBeTruthy();
  });

  it('turns compact at 389 dp: 24 / 15, short captions, gap 12', async () => {
    at(389);
    await sheet();
    const figure = screen.getByTestId('route-distance');
    expect(flat(figure.props.style).fontSize).toBe(24);
    expect(flat(figure.props.style).fontWeight).toBe('800');
    expect(figure.props.numberOfLines).toBe(1);
    expect(flat(within(figure).getByText(/km/).props.style).fontSize).toBe(15);
    expect(flat(screen.getByTestId('route-figures').props.style).gap).toBe(12);
    expect(screen.getByText('Montée')).toBeTruthy();
    expect(screen.getByText('Durée')).toBeTruthy();
    expect(screen.queryByText('Montée (D+)')).toBeNull();
    const chevron = screen
      .getByTestId('route-open-infos')
      .children.pop() as any;
    expect(flat(chevron.props.style).width).toBe(48);
    expect(flat(chevron.props.style).marginLeft).toBe(8);
  });

  it('divides the width by the text scale: 411 dp at 1.3 is compact', async () => {
    at(411, 1.3);
    await sheet();
    expect(
      flat(screen.getByTestId('route-distance').props.style).fontSize,
    ).toBe(24);
  });

  it('411 dp at scale 1 is normal', async () => {
    at(411);
    await sheet();
    expect(
      flat(screen.getByTestId('route-distance').props.style).fontSize,
    ).toBe(28);
  });

  it('keeps the long names for the reader in both modes', async () => {
    at(360);
    await sheet();
    expect(
      screen.getByTestId('route-open-infos').props.accessibilityLabel,
    ).toMatch(/Montée \(D\+\)\u00A0: 1\u202F250\u202Fm/);
  });
});

describe('T9 summary: pressed corners', () => {
  it('clips the ripple to the radius of 18', async () => {
    await render(
      <RouteSummarySheet
        distanceKm={25.1}
        durationS={5700}
        ascentM={421}
        onOpen={() => {}}
      />,
    );
    const style = flat(screen.getByTestId('route-open-infos').props.style);
    expect(style.overflow).toBe('hidden');
    expect(style.borderRadius).toBe(18);
  });
});

describe('T9 C2: arch margins', () => {
  it('are 20 / 56 / 32 / 56 (top, right, bottom, left)', async () => {
    await renderReady([P1, P2]);
    expect(mockCameraProps.initialViewState.padding).toEqual({
      top: 20,
      right: 56,
      bottom: 32,
      left: 56,
    });
  });
});

describe('T9 arch: long routes', () => {
  it('the Infos map may zoom out under the zoom 8 of the main map', async () => {
    await renderReady([P1, P2]);
    expect(mockCameraProps.minZoom).toBe(0);
  });
});

describe('T9 C1: thousands separator in the summary', () => {
  it('is written big in the summary figure', async () => {
    await render(
      <RouteSummarySheet distanceKm={60} durationS={9000} ascentM={1250} />,
    );
    expect(screen.getByTestId('route-ascent')).toHaveTextContent(
      '1\u202F250\u202Fm',
    );
  });
});

describe('T9 C2: framing', () => {
  const line = (coordinates: [number, number][]) =>
    ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      ],
    }) as never;

  it('has no margin around the route', () => {
    const bounds = routeBounds(
      { points: [], modes: [] },
      line([
        [6.1, 48.6],
        [6.2, 48.7],
      ]),
    );
    expect(bounds).toEqual([6.1, 48.6, 6.2, 48.7]);
  });

  it('keeps a little margin on a flat box', () => {
    const bounds = routeBounds(
      { points: [], modes: [] },
      line([
        [6.1, 48.6],
        [6.2, 48.6],
      ]),
    );
    expect(bounds?.[0]).toBe(6.1);
    expect((bounds?.[1] as number) < 48.6).toBe(true);
    expect((bounds?.[3] as number) > 48.6).toBe(true);
  });
});

describe('T9 C3: no place names in the arch', () => {
  it('buildMapStyle drops the symbol layers with labels: false', () => {
    const input = {
      files: { map: 'file:///m', terrain: 'file:///t', contours: 'file:///c' },
      glyphsDir: 'file:///g',
      bbox: zone.bbox,
    };
    const types = (s: unknown) =>
      (s as { layers: { type: string }[] }).layers.map((l) => l.type);
    expect(types(buildMapStyle(input))).toContain('symbol');
    expect(types(buildMapStyle({ ...input, labels: false }))).not.toContain(
      'symbol',
    );
  });

  it('the Infos map asks for no labels', async () => {
    await renderReady([P1, P2]);
    const layers = (mockMapProps.mapStyle as { layers: { type: string }[] })
      .layers;
    expect(layers.map((l) => l.type)).not.toContain('symbol');
  });
});

describe('T9 screen: C4, C5, C6', () => {
  it('C4: the legend is brown', async () => {
    await renderReady([P1, P2]);
    expect(flat(screen.getByText('Route 25 %').props.style).color).toBe(
      '#3A1F0F',
    );
  });

  it('C5: "À la main" is dashes, in the band and in the legend', async () => {
    await renderReady([P1, P2, { ...P3, hand: true }]);
    const band = screen.getByTestId('info-band-hand');
    expect(band.props.fill.payload).toBe(0xffffffff);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('"strokeDasharray":["12","6"]');
    expect(tree).toContain('"strokeDasharray":["6","3"]');
  });

  it('C6: altitudes missing keeps four cells, the title and one line', async () => {
    mockHeights.mockResolvedValue(failed);
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('—');
    expect(screen.getByText('Montée (D+)')).toBeTruthy();
    expect(screen.getByText('Descente (D−)')).toBeTruthy();
    expect(
      screen.getByLabelText('Montée (D+)\u00A0: altitudes indisponibles'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Descente (D−)\u00A0: altitudes indisponibles'),
    ).toBeTruthy();
    expect(screen.getByText('Profil et terrain')).toBeTruthy();
    expect(screen.getByTestId('info-altitudes-missing')).toHaveTextContent(
      'Altitudes indisponibles',
    );
    expect(screen.queryByTestId('info-profile')).toBeNull();
    expect(screen.queryByTestId('info-range')).toBeNull();
    expect(screen.getByTestId('info-legend')).toBeTruthy();
  });

  it('C6: both missing give two lines under the title', async () => {
    mockHeights.mockResolvedValue(failed);
    mockTerrain.mockResolvedValue(failed);
    await renderReady([P1, P2]);
    expect(screen.getByText('Profil et terrain')).toBeTruthy();
    expect(screen.getByTestId('info-altitudes-missing')).toBeTruthy();
    expect(screen.getByTestId('info-terrain-missing')).toBeTruthy();
  });

  it('C1: the range and the cells group thousands', async () => {
    mockHeights.mockResolvedValue({
      ok: true,
      profile: [
        [0, 1020],
        [1000, 1424],
        [3000, 1100],
      ],
    });
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-range')).toHaveTextContent(
      'de 1\u202F020 à 1\u202F424\u202Fm',
    );
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('404\u202Fm');
  });
});
