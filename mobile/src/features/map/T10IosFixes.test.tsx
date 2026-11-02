import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react-native';
import * as RN from 'react-native';
import { StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import type { Zone } from '@/core/zones/catalogue';

import { DraftSessionContext } from './DraftSession';
import { createDraftStore } from './draftStore';
import { DraftInSession } from './testing/DraftInSession';
import { ZoneMap } from './ZoneMap';
import { RouteInfoScreen } from './RouteInfoScreen';
import { RouteSummarySheet } from './RouteSheets';

// MapLibre, the router, the disk and the engine are replaced.
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockBack = jest.fn();
const mockShowAttribution = jest.fn();

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
    Camera: () => null,
    Layer: () => null,
    GeoJSONSource: () => null,
  };
});
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({
    data: [
      {
        localFormat: 1,
        installedAt: '2026-10-25T10:00:00.000Z',
        zone: {
          id: 'nancy',
          name: 'Nancy',
          version: 3,
          bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
          osmDate: '2026-10-22T20:21:33Z',
          totalBytes: 1,
          files: [],
        },
      },
    ],
  }),
}));
jest.mock('./MapPosition', () => ({
  NO_PADDING: { top: 0, right: 0, bottom: 0, left: 0 },
  RECENTER_ZOOM: 14,
  RecenterButton: () => null,
  UserPositionLayers: () => null,
  useMapPosition: () => ({
    granted: false,
    lon: undefined,
    lat: undefined,
    recenter: () => {},
  }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, navigate: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: () => {},
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

const route = {
  ok: true,
  shape: [
    [6.1, 48.66],
    [6.14, 48.68],
  ],
  distanceKm: 3,
  durationS: 900,
};
const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});
beforeEach(() => {
  jest.clearAllMocks();
  mockComputeRoute.mockResolvedValue(route);
  mockHeights.mockResolvedValue({ ok: true, profile: [[0, 100]] });
  mockTerrain.mockResolvedValue({ ok: true, edges: [] });
});

const flat = (style: unknown) => StyleSheet.flatten(style as never);

describe('T10 E1: summary corners', () => {
  const sheet = (onOpen?: () => void) =>
    render(
      <RouteSummarySheet
        distanceKm={125.4}
        durationS={38700}
        ascentM={1250}
        onOpen={onOpen}
      />,
    );
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(RN.Dimensions, 'get');
  });
  afterEach(() => spy.mockRestore());

  it('pads the Pressable by 6 / 4 and gives the room back in negative', async () => {
    await sheet(() => {});
    const style = flat(screen.getByTestId('route-open-infos').props.style);
    expect(style.paddingHorizontal).toBe(6);
    expect(style.paddingVertical).toBe(4);
    expect(style.marginHorizontal).toBe(-6);
    expect(style.marginVertical).toBe(-4);
    expect(style.overflow).toBe('hidden');
    expect(style.borderRadius).toBe(18);
  });

  it('uses the same box when the summary does not open', async () => {
    await sheet();
    const box = screen.getByTestId('route-open-infos-off', {
      includeHiddenElements: true,
    }).parent as any;
    const style = flat(box.props.style);
    expect(style.paddingHorizontal).toBe(6);
    expect(style.marginHorizontal).toBe(-6);
  });

  it.each([
    [390, 16, 48, 12],
    [360, 12, 48, 8],
  ])(
    'keeps the T9 rules at %i dp: gap %i, chevron %i wide, margin %i',
    async (width, gap, chevronWidth, chevronMargin) => {
      spy.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
      await sheet(() => {});
      expect(flat(screen.getByTestId('route-figures').props.style).gap).toBe(
        gap,
      );
      const chevron = screen
        .getByTestId('route-open-infos')
        .children.pop() as any;
      expect(flat(chevron.props.style).width).toBe(chevronWidth);
      expect(flat(chevron.props.style).marginLeft).toBe(chevronMargin);
    },
  );
});

describe('T10 E2: attribution keeps its size', () => {
  it('caps the short attribution and the "i" at 1', async () => {
    const session = createDraftStore();
    session.dispatch({ type: 'chooseMode', mode: 'path' });
    session.dispatch({ type: 'add', lon: 6.1, lat: 48.66 });
    session.dispatch({ type: 'chooseMode', mode: 'path' });
    session.dispatch({ type: 'add', lon: 6.14, lat: 48.68 });
    const client = new QueryClient();
    clients.push(client);
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
    expect(screen.getByText(/OpenStreetMap/).props.maxFontSizeMultiplier).toBe(
      1,
    );
    expect(
      within(screen.getByTestId('info-attribution-button')).getByText('i').props
        .maxFontSizeMultiplier,
    ).toBe(1);
  });
});

describe('T10 E2: creation map attribution', () => {
  it('caps the short attribution at 1', async () => {
    await render(<ZoneMap zone={zone} />);
    expect(screen.getByText(/OpenStreetMap/).props.maxFontSizeMultiplier).toBe(
      1,
    );
  });
});

describe('T10 E2: only the attribution is capped', () => {
  it('leaves the summary figures and the "Distance" legend scalable', async () => {
    await render(
      <RouteSummarySheet distanceKm={3} durationS={900} ascentM={50} />,
    );
    expect(
      screen.getByTestId('route-distance').props.maxFontSizeMultiplier,
    ).not.toBe(1);
    expect(screen.getByText('Distance').props.maxFontSizeMultiplier).not.toBe(
      1,
    );
  });
});

describe('T10 E2: creation screen attribution', () => {
  it('caps the short attribution at 1', async () => {
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <DraftInSession />
      </QueryClientProvider>,
    );
    await act(async () => {});
    expect(screen.getByText(/OpenStreetMap/).props.maxFontSizeMultiplier).toBe(
      1,
    );
  });
});
