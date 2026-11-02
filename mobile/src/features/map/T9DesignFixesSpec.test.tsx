import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react-native';
import * as RN from 'react-native';
import { StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { groupThousands } from '@/core/routing/formatRoute';
import type { Zone } from '@/core/zones/catalogue';

import { DraftSessionContext } from './DraftSession';
import { createDraftStore } from './draftStore';
import { RouteInfoScreen } from './RouteInfoScreen';
import { RouteSummarySheet } from './RouteSheets';
import { ZoneBaseMap } from './ZoneBaseMap';

// MapLibre, the router, the disk and the engine are replaced.
const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockBack = jest.fn();
const mockShowAttribution = jest.fn();
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

// Window of a phone: width in dp and text scale.
let windowSpy: jest.SpyInstance;
const windowOf = (width: number, fontScale = 1) =>
  windowSpy.mockReturnValue({ width, height: 900, scale: 1, fontScale });
beforeEach(() => {
  windowSpy = jest.spyOn(RN.Dimensions, 'get');
  windowOf(411);
});
afterEach(() => windowSpy.mockRestore());

const NNBSP = '\u202F';

function summary(props: Partial<Parameters<typeof RouteSummarySheet>[0]> = {}) {
  return render(
    <RouteSummarySheet
      distanceKm={125.4}
      durationS={38700}
      ascentM={1250}
      {...props}
    />,
  );
}

// Altitude profile of a route: [metres along, altitude].
const climb = (low: number, high: number) => ({
  ok: true,
  profile: [
    [0, low],
    [3000, high],
  ],
});

// Rendered tree, as plain objects.
type Node = {
  type: string;
  props: Record<string, any>;
  children: (Node | string)[] | null;
};
function walk(
  node: Node | string | null | undefined,
  visit: (n: Node) => void,
) {
  if (!node || typeof node === 'string') return;
  visit(node);
  node.children?.forEach((child) => walk(child, visit));
}
function find(match: (n: Node) => boolean, root?: Node): Node[] {
  const found: Node[] = [];
  walk(root ?? (screen.toJSON() as unknown as Node), (n) => {
    if (match(n)) found.push(n);
  });
  return found;
}
const byTestId = (id: string) => find((n) => n.props.testID === id)[0]!;

// Points of the drawn line of the profile (the stroked path of width 2.5).
function profileLine(): { x: number; y: number }[] {
  const path = find(
    (n) => n.type === 'RNSVGPath' && n.props.strokeWidth === 2.5,
  )[0]!;
  const numbers = String(path.props.d)
    .replace(/[ML]/g, ' ')
    .trim()
    .split(/\s+/);
  const line: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2)
    line.push({ x: Number(numbers[i]), y: Number(numbers[i + 1]) });
  return line;
}

describe('B1: one target, the chevron is only its sign', () => {
  it('has a single button, whatever the mode', async () => {
    for (const width of [360, 411]) {
      windowOf(width);
      const view = await summary({ onOpen: () => {} });
      expect(screen.getAllByRole('button')).toHaveLength(1);
      await view.unmount();
    }
  });

  it('has no button at all when the summary cannot open', async () => {
    await summary();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByTestId('route-open-infos')).toBeNull();
  });

  it('draws the chevron at 40 % when the summary is not touchable, full when it is', async () => {
    const closed = await summary();
    const off = screen.getByTestId('route-open-infos-off', {
      includeHiddenElements: true,
    });
    expect(flat(off.props.style).opacity).toBe(0.4);
    await closed.unmount();
    await summary({ onOpen: () => {} });
    const pressable = screen.getByTestId('route-open-infos');
    const chevron = (pressable.children as any[]).pop();
    expect(flat(chevron.props.style).opacity).toBeUndefined();
  });

  it.each([360, 411])(
    'has the same row box and the same 48 chevron open or not (%i dp)',
    async (width) => {
      windowOf(width);
      const open = await summary({ onOpen: () => {} });
      const openBox = flat(screen.getByTestId('route-open-infos').props.style);
      const openChevron = flat(
        (screen.getByTestId('route-open-infos').children as any[]).pop().props
          .style,
      );
      await open.unmount();
      await summary();
      const off = screen.getByTestId('route-open-infos-off', {
        includeHiddenElements: true,
      });
      const closedBox = flat(off.parent?.props.style);
      const closedChevron = flat(off.props.style);
      expect(closedBox).toEqual(openBox);
      expect(closedChevron.width).toBe(48);
      expect(openChevron.width).toBe(48);
      expect(closedChevron.height).toBe(openChevron.height);
      expect(closedChevron.marginLeft).toBe(openChevron.marginLeft);
    },
  );

  it.each([
    ['compact', 360],
    ['normal', 411],
  ])(
    'names the target with the long captions in %s mode',
    async (_mode, width) => {
      windowOf(width);
      await summary({ onOpen: () => {} });
      const label: string =
        screen.getByTestId('route-open-infos').props.accessibilityLabel;
      expect(label).toContain("Infos de l'itinéraire");
      expect(label).toContain(`125,4${NNBSP}km`);
      expect(label).toContain(`Montée (D+)\u00A0: 1${NNBSP}250${NNBSP}m`);
      // Never the short captions alone.
      expect(label).not.toMatch(/Montée(?! \(D\+\))/);
    },
  );
});

describe('B1: the long captions stay in the accessible name', () => {
  // Decision 2: "les noms accessibles gardent les légendes longues
  // (« Montée (D+) », « Durée estimée »), dans les deux modes".
  it.each([360, 411])('names Distance and Durée estimée (%i dp)', async (w) => {
    windowOf(w);
    await summary({ onOpen: () => {} });
    const label: string =
      screen.getByTestId('route-open-infos').props.accessibilityLabel;
    expect(label).toContain('Distance');
    expect(label).toContain('Durée estimée');
  });
});

describe('Compact summary below 390 dp (text scale removed)', () => {
  const sizeOf = () =>
    ['route-distance', 'route-ascent', 'route-duration'].map(
      (id) => flat(screen.getByTestId(id).props.style).fontSize,
    );

  it.each([
    [389, 1, 'compact'],
    [390, 1, 'normal'],
    [360, 1, 'compact'],
    [411, 1, 'normal'],
    [390, 1.01, 'compact'], // 386 dp
    [779, 2, 'compact'], // 389,5 dp
    [780, 2, 'normal'], // 390 dp
    [411, 1.3, 'compact'], // 316 dp
  ])('%i dp, text scale %f: %s', async (width, fontScale, mode) => {
    windowOf(width, fontScale);
    await summary();
    expect(sizeOf()).toEqual(mode === 'compact' ? [24, 24, 24] : [28, 28, 28]);
  });

  it('writes Distance / Montée / Durée and 24-point digits in compact', async () => {
    windowOf(360);
    await summary();
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('Montée')).toBeTruthy();
    expect(screen.getByText('Durée')).toBeTruthy();
    expect(screen.queryByText('Montée (D+)')).toBeNull();
    expect(screen.queryByText('Durée estimée')).toBeNull();
    for (const id of ['route-distance', 'route-ascent', 'route-duration']) {
      const style = flat(screen.getByTestId(id).props.style);
      expect(style.fontSize).toBe(24);
      expect(style.fontWeight).toBe('800');
      expect(screen.getByTestId(id).props.numberOfLines).toBe(1);
    }
    // Units in 15, bold.
    const unit = within(screen.getByTestId('route-ascent')).getByText(/m/);
    expect(flat(unit.props.style).fontSize).toBe(15);
    expect(flat(unit.props.style).fontWeight).toBe('700');
  });

  it('keeps the long captions, 28-point digits and 17-point units in normal', async () => {
    windowOf(411);
    await summary();
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('Montée (D+)')).toBeTruthy();
    expect(screen.getByText('Durée estimée')).toBeTruthy();
    const unit = within(screen.getByTestId('route-ascent')).getByText(/m/);
    expect(flat(unit.props.style).fontSize).toBe(17);
  });

  it('never wraps a caption', async () => {
    windowOf(360);
    await summary();
    for (const name of ['Distance', 'Montée', 'Durée']) {
      expect(screen.getByText(name).props.numberOfLines).toBe(1);
    }
  });

  it('puts 12 between the columns in compact', async () => {
    windowOf(360);
    await summary({ onOpen: () => {} });
    expect(flat(screen.getByTestId('route-figures').props.style).gap).toBe(12);
  });

  // Decision 2, table: 16 between the columns in the normal mode.
  it('puts 16 between the columns in normal', async () => {
    windowOf(411);
    await summary({ onOpen: () => {} });
    expect(flat(screen.getByTestId('route-figures').props.style).gap).toBe(16);
  });

  // Decision 2, table: before the chevron, auto (at least 12) in normal, auto
  // (at least 8) in compact.
  it.each([
    [360, 8],
    [411, 12],
  ])(
    'at width %i, keeps at least %i before the chevron',
    async (width, min) => {
      windowOf(width);
      await summary({ onOpen: () => {} });
      const chevron = (
        screen.getByTestId('route-open-infos').children as any[]
      ).pop();
      expect(flat(chevron.props.style).marginLeft ?? 0).toBeGreaterThanOrEqual(
        min,
      );
    },
  );
});

describe('C1: thousands grouped by U+202F', () => {
  it.each([
    [999, '999'],
    [1000, `1${NNBSP}000`],
    [1250, `1${NNBSP}250`],
    [12345, `12${NNBSP}345`],
  ])('the summary writes %i as "%s m"', async (metres, digits) => {
    await summary({ ascentM: metres });
    expect(screen.getByTestId('route-ascent')).toHaveTextContent(
      `${digits}${NNBSP}m`,
    );
    // The digits are loose text; only " m" is in the small nested text.
    const figure = screen.getByTestId('route-ascent');
    const kids = figure.children as any[];
    expect(kids.filter((k) => typeof k === 'string').join('')).toBe(digits);
    const unit = kids.find((k) => typeof k !== 'string');
    expect(unit.children.join('')).toBe(`${NNBSP}m`);
  });

  it.each([
    [999, '999', `1${NNBSP}099`],
    [1000, `1${NNBSP}000`, `1${NNBSP}100`],
    [1250, `1${NNBSP}250`, `1${NNBSP}350`],
    [12345, `12${NNBSP}345`, `12${NNBSP}445`],
  ])('Infos writes a climb of %i m as "%s m"', async (metres, digits, max) => {
    mockHeights.mockResolvedValue(climb(100, 100 + metres));
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-ascent')).toHaveTextContent(
      `${digits}${NNBSP}m`,
    );
    expect(screen.getByTestId('info-descent')).toHaveTextContent(`0${NNBSP}m`);
    expect(screen.getByTestId('info-range')).toHaveTextContent(
      `de 100 à ${max}${NNBSP}m`,
    );
  });

  it('Infos groups the descent too', async () => {
    mockHeights.mockResolvedValue(climb(1350, 100));
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-descent')).toHaveTextContent(
      `1${NNBSP}250${NNBSP}m`,
    );
    expect(screen.getByTestId('info-range')).toHaveTextContent(
      `de 100 à 1${NNBSP}350${NNBSP}m`,
    );
  });

  it('groupThousands only uses U+202F, never an ordinary or no-break space', () => {
    expect(groupThousands(1250)).not.toMatch(/[ \u00A0]/);
    expect(groupThousands(1250).charCodeAt(1)).toBe(0x202f);
  });
});

describe('C5: "À la main" is dashed everywhere', () => {
  it('draws the band in magenta dashes of 12 / 6, over white, 12 high', async () => {
    await renderReady([P1, P2, { ...P3, hand: true }]);
    const json = JSON.stringify(screen.toJSON());
    expect(json).toContain('"strokeDasharray":["12","6"]');
    expect(json).toMatch(/"strokeWidth":"?12"?/);
    // The base of the segment is white (carte.itineraire-lisere).
    expect(screen.getByTestId('info-band-hand').props.fill.payload).toBe(
      0xffffffff,
    );
    // The dashes are magenta #C2007A.
    expect(json).toContain(String(0xffc2007a));
  });

  it('draws the legend with the 22 x 8 dashed stroke (6 / 3, width 4), not a round dot', async () => {
    await renderReady([P1, P2, { ...P3, hand: true }]);
    const legend = byTestId('info-legend');
    const dashed = find((n) => n.props.strokeDasharray !== undefined, legend);
    expect(dashed).toHaveLength(1);
    expect(dashed[0]!.props.strokeDasharray).toEqual(['6', '3']);
    expect(dashed[0]!.props.strokeWidth).toBe(4);
    const svg = find((n) => n.type === 'RNSVGSvgView', legend);
    expect(svg).toHaveLength(1);
    expect(svg[0]!.props.bbWidth).toBe(22);
    expect(svg[0]!.props.bbHeight).toBe(8);
    // The three other parts keep their round dot of 15.
    const dots = find((n) => flat(n.props.style)?.width === 15, legend);
    expect(dots).toHaveLength(3);
  });

  it('draws no dash when no leg is drawn by hand', async () => {
    await renderReady([P1, P2]);
    const json = JSON.stringify(screen.toJSON());
    expect(json).not.toContain('"strokeDasharray":["12","6"]');
    expect(json).not.toContain('"strokeDasharray":["6","3"]');
  });
});

describe('C6: altitudes unavailable', () => {
  it('keeps four cells with the same labels, a dash and an accessible reason', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await renderReady([P1, P2]);
    for (const id of [
      'info-distance',
      'info-duration',
      'info-ascent',
      'info-descent',
    ]) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    expect(screen.getByTestId('info-ascent')).toHaveTextContent('—');
    expect(screen.getByTestId('info-descent')).toHaveTextContent('—');
    expect(
      screen.getByLabelText(`Montée (D+)\u00A0: altitudes indisponibles`),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `Descente (D\u2212)\u00A0: altitudes indisponibles`,
      ),
    ).toBeTruthy();
  });

  it('keeps the title and puts one line, without frame, in place of the profile', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await renderReady([P1, P2]);
    expect(screen.getByText('Profil et terrain')).toBeTruthy();
    const line = screen.getByTestId('info-altitudes-missing');
    expect(line).toHaveTextContent('Altitudes indisponibles');
    const style = flat(line.props.style);
    expect(style.color).toBe('#3A1F0F');
    expect(style.borderWidth).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
    expect(style.fontSize).toBe(15);
    expect(screen.queryByTestId('info-profile')).toBeNull();
    // The legend follows, unchanged.
    expect(screen.getByTestId('info-legend')).toBeTruthy();
  });

  it('with missing terrain: one line under the profile', async () => {
    mockTerrain.mockResolvedValue({ ok: false, error: 'failed' });
    await renderReady([P1, P2]);
    expect(screen.getByTestId('info-profile')).toBeTruthy();
    expect(screen.getByText('Terrain indisponible')).toBeTruthy();
    expect(screen.queryByTestId('info-legend')).toBeNull();
  });
});

describe('C7: scale of the profile', () => {
  // Rule of p05-t8 C7: shown span = max(high - low, 100 m) / 0,85, with 12 %
  // of it under the lowest altitude. Worked by hand: 202 to 240 m gives a
  // scale of 117,65 m starting at 187,88 m; y = 84 - (alt - 187,88) / 117,65
  // * 84 for a plot of 84.
  it('a small climb (202 to 240 m) stays in the lower third', async () => {
    mockHeights.mockResolvedValue(climb(202, 240));
    await renderReady([P1, P2]);
    const [start, end] = profileLine();
    expect(start!.y).toBeCloseTo(73.9, 1); // 12 % of 84 above the axis
    expect(end!.y).toBeCloseTo(46.8, 1);
    expect(start!.y - end!.y).toBeLessThan(84 / 3 + 1); // a third of the plot
    expect(screen.getByTestId('info-range')).toHaveTextContent(
      `de 202 à 240${NNBSP}m`,
    );
  });

  it('a flat route stays flat, 12 % over the axis', async () => {
    mockHeights.mockResolvedValue(climb(300, 300));
    await renderReady([P1, P2]);
    const ys = profileLine().map((p) => p.y);
    expect(ys.length).toBeGreaterThan(1);
    for (const y of ys) expect(y).toBeCloseTo(73.9, 1);
  });

  it('a climb of 100 m or more starts at 12 % and tops at 85 % of the height', async () => {
    mockHeights.mockResolvedValue(climb(245, 390));
    await renderReady([P1, P2]);
    const [start, end] = profileLine();
    // 145 m / 0,85 = 170,59 m; low = 245 - 20,47 m.
    expect(start!.y).toBeCloseTo(84 * 0.88, 1);
    expect(end!.y).toBeCloseTo(84 * 0.03, 0); // top: 15 % of room above
  });
});

describe('C2: arch margins 20 / 56 / 32 / 56', () => {
  it('pads the camera of the Infos map: top 20, right 56, bottom 32, left 56', async () => {
    await renderReady([P1, P2, P3]);
    expect(mockCameraProps.initialViewState.padding).toEqual({
      top: 20,
      right: 56,
      bottom: 32,
      left: 56,
    });
  });
});

describe('minZoom of the maps', () => {
  const props = {
    zone,
    cameraRef: null,
  };

  it('is 0 for the Infos map (a long route must fit the arch)', async () => {
    await renderReady([P1, P2, P3]);
    expect(mockCameraProps.minZoom).toBe(0);
  });

  it('is 8 for the creation map (no fit)', async () => {
    await render(
      <ZoneBaseMap {...props} opening={{ center: [6.1, 48.66], zoom: 12 }} />,
    );
    expect(mockCameraProps.minZoom).toBe(8);
  });

  it('is 0 for a map opened on a box, 8 without', async () => {
    const fit = {
      bounds: [6.1, 48.6, 6.2, 48.7] as [number, number, number, number],
      padding: { top: 20, right: 56, bottom: 32, left: 56 },
    };
    const view = await render(<ZoneBaseMap {...props} fit={fit} />);
    expect(mockCameraProps.minZoom).toBe(0);
    await view.unmount();
    await render(<ZoneBaseMap {...props} />);
    expect(mockCameraProps.minZoom).toBe(8);
  });
});
