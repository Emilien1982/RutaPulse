// Tests of the phase 3 creation, ported to the full screen creation
// (`DraftScreen`, route `/draft`). The table of correspondence is in
// docs/phases/preuves/p04/t4-tests-portes.md: one line per test.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';
import { MapScreen } from './MapScreen';

// MapLibre, the router, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
const mockSources: Record<string, any> = {};
const mockLayers: Record<string, any> = {};
// Number of mounts of each fake GeoJSON source; an entry of `mockSources`
// goes away when its source is unmounted.
const mockMounts: Record<string, number> = {};
const mockAnnotations: Record<string, any> = {};
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();
const mockEaseTo = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockPrevent: { value: boolean; callback: (o: any) => void } | undefined;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: mockEaseTo }));
      return null;
    },
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
    Layer: (props: { id: string }) => {
      mockLayers[props.id] = props;
      return null;
    },
    GeoJSONSource: (props: { id: string; children: ReactNode }) => {
      const { useEffect } = jest.requireActual('react');
      mockSources[props.id] = props;
      useEffect(() => {
        mockMounts[props.id] = (mockMounts[props.id] ?? 0) + 1;
        return () => {
          delete mockSources[props.id];
        };
      }, [props.id]);
      return <>{props.children}</>;
    },
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    ViewAnnotation: (props: { id: string; children: ReactNode }) => {
      mockAnnotations[props.id] = props;
      return <View testID={`annotation:${props.id}`}>{props.children}</View>;
    },
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, navigate: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: (value: boolean, callback: (o: any) => void) => {
    mockPrevent = { value, callback };
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: (...args: unknown[]) => mockComputeRoute(...args),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const nancy: ReadyMarker = {
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
};

const HAYE: [number, number] = [6.1015, 48.6612];
const NANCY: [number, number] = [6.1408, 48.6846];
const THIRD: [number, number] = [6.2, 48.7];
const OUTSIDE: [number, number] = [2.35, 48.85];

// Phase 3 figures: mockup 10 shows "25,1 km" and "1 h 35".
const SUCCESS: RouteResult = {
  ok: true,
  shape: [HAYE, NANCY],
  distanceKm: 25.1,
  durationS: 95 * 60,
};

// Line of the dotted link tests: it ends 1 m (0.001 deg) from the points.
const SHAPE: [number, number][] = [
  [6.1, 48.6],
  [6.11, 48.61],
  [6.12, 48.62],
];
const LINKED: RouteResult = {
  ok: true,
  shape: SHAPE,
  distanceKm: 3,
  durationS: 600,
};

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
);

async function renderDraft() {
  await render(wrap(<DraftScreen />));
  await act(async () => {});
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const press = (at: [number, number]) =>
  (mockMapProps.onPress as (e: unknown) => void)({
    nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
  });

// A touch on the map; it waits the 120 ms guard of the screen.
async function touchMap(at: [number, number]) {
  await act(async () => {
    press(at);
    await new Promise((resolve) => setTimeout(resolve, 130));
  });
  await flush();
}

async function addPoints(...points: [number, number][]) {
  for (const p of points) await touchMap(p);
}

function pointIds() {
  return screen
    .queryAllByTestId(/^annotation:/)
    .map((node) => String(node.props.testID).slice('annotation:'.length));
}

async function pressAnnotation(n: number) {
  await act(async () => {
    mockAnnotations[pointIds()[n - 1] as string].onPress();
  });
}

// All the text of a node, as written (no folding of the narrow space).
type Node = ReturnType<typeof screen.getByTestId>;
function textOf(node: Node): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : textOf(child as Node)))
    .join('');
}

function linkFeatures(): { geometry: { coordinates: number[][] } }[] {
  return mockSources['draft-link']?.data.features ?? [];
}

// Top of the absolute wrapper around the recenter button.
function recenterTop() {
  let node = screen.getByRole('button', { name: 'Recentrer sur ma position' });
  while (node.parent) {
    const top = StyleSheet.flatten(node.props.style)?.top;
    if (top !== undefined) return top;
    node = node.parent;
  }
  throw new Error('no wrapper with top');
}

async function waitForRemoval() {
  await fireEvent.press(screen.getByTestId('route-error-remove'));
}

beforeEach(() => {
  jest.clearAllMocks();
  // The queue of `mockResolvedValueOnce` must not leak from a test to the next.
  mockComputeRoute.mockReset();
  mockInstalled = [nancy];
  mockPrevent = undefined;
  for (const o of [mockSources, mockLayers, mockAnnotations, mockMounts]) {
    for (const key of Object.keys(o)) delete o[key];
  }
  mockComputeRoute.mockResolvedValue(SUCCESS);
});

describe('port: "Nouvel itinéraire" and the cross (RouteCreation.test)', () => {
  it('the button of the map tab opens /draft instead of drawing in place', async () => {
    await render(wrap(<MapScreen />));
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('new-route-button'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]?.[0]).toMatchObject({ pathname: '/draft' });
    // Nothing is drawn on the map tab itself.
    expect(screen.queryByTestId('route-hint')).toBeNull();
    expect(screen.queryByTestId('route-summary')).toBeNull();
  });

  it('opens the creation: top bar, hint, no "Nouvel itinéraire" button', async () => {
    await renderDraft();
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    expect(screen.queryByTestId('new-route-button')).toBeNull();
    expect(screen.getByTestId('route-hint')).toBeTruthy();
    expect(screen.getByText('Touchez le départ sur la carte')).toBeTruthy();
  });

  it('closes the creation with the cross, without a question under 2 points', async () => {
    await renderDraft();
    await addPoints(HAYE);
    expect(mockPrevent?.value).toBe(false);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Fermer sans enregistrer' }),
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('the map tab ignores the touches: no point, no engine call', async () => {
    await render(wrap(<MapScreen />));
    await act(async () => {});
    const onPress = mockMapProps.onPress as ((e: unknown) => void) | undefined;
    await act(async () => {
      onPress?.({ nativeEvent: { lngLat: HAYE, point: { x: 0, y: 0 } } });
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(screen.queryAllByTestId(/^annotation:/)).toHaveLength(0);
    expect(screen.queryByTestId('route-summary')).toBeNull();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });
});

describe('port: creating a route (RouteCreation.test, RouteCreationT4Testeur)', () => {
  it('the first touch sets the start and asks for the end, no engine call', async () => {
    await renderDraft();
    await addPoints(HAYE);
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(screen.getByText("Touchez l'arrivée sur la carte")).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('the second touch computes, the figures fade meanwhile, then show 25,1 km and 1 h 35', async () => {
    let finish: (r: RouteResult) => void = () => {};
    mockComputeRoute.mockReturnValue(
      new Promise<RouteResult>((resolve) => (finish = resolve)),
    );
    await renderDraft();
    await addPoints(HAYE, NANCY);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(mockComputeRoute.mock.calls[0]?.[0]).toEqual([
      { id: 1, lon: HAYE[0], lat: HAYE[1] },
      { id: 2, lon: NANCY[0], lat: NANCY[1] },
    ]);
    // While the engine works: the summary stays, faded.
    expect(screen.getByTestId('route-summary')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('route-figures').props.style)
        .opacity,
    ).toBeLessThan(1);
    await act(async () => finish(SUCCESS));
    await flush();
    expect(
      StyleSheet.flatten(screen.getByTestId('route-figures').props.style)
        .opacity,
    ).toBeUndefined();
    // Mockup 10, with the narrow no-break space (gap M1 of p03-t6.md).
    expect(textOf(screen.getByTestId('route-distance'))).toBe('25,1 km');
    expect(textOf(screen.getByTestId('route-duration'))).toBe('1 h 35');
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('Durée estimée')).toBeTruthy();
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
    expect(mockSources['draft-legs'].data.features[0].geometry).toEqual({
      type: 'LineString',
      coordinates: SUCCESS.ok && SUCCESS.shape,
    });
  });

  it('full path: title, one call, figures, the cross asks nothing wrong, "Enregistrer" and "D+" absent', async () => {
    await renderDraft();
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    await addPoints(HAYE, NANCY);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('25,1 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('1 h 35');
    // Out of the phase 4 scope (spec): no save button, no elevation.
    for (const word of ['Enregistrer', 'D\\+']) {
      expect(screen.queryByText(new RegExp(word))).toBeNull();
    }
    // 2 points: the way out is guarded.
    expect(mockPrevent?.value).toBe(true);
    await fireEvent.press(screen.getByTestId('route-close'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('two touches in the same act add two points and compute one leg', async () => {
    await renderDraft();
    await act(async () => {
      press(HAYE);
      press(NANCY);
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    await flush();
    expect(pointIds()).toHaveLength(2);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(mockComputeRoute.mock.calls[0]?.[0]).toEqual([
      { id: 1, lon: HAYE[0], lat: HAYE[1] },
      { id: 2, lon: NANCY[0], lat: NANCY[1] },
    ]);
    expect(screen.getByTestId('route-summary')).toBeTruthy();
  });

  it('a touch right after the screen opens sets the start', async () => {
    await render(wrap(<DraftScreen />));
    await act(async () => {
      press(HAYE);
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(pointIds()).toHaveLength(1);
  });
});

describe('port: errors (RouteCreation.test, RouteCreationT4Testeur)', () => {
  it('a first point outside the zone: sheet of mockup 52, engine not called, no download button', async () => {
    await renderDraft();
    await addPoints(OUTSIDE);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByText(/aucune zone de RutaPulse/)).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(screen.queryByText(/Télécharger/)).toBeNull();
  });

  it('outOfZone answered by the engine is shown the same way', async () => {
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'outOfZone' });
    await renderDraft();
    await addPoints(HAYE, NANCY);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    expect(pointIds()).toHaveLength(1);
    await waitForRemoval();
    expect(screen.queryByTestId('route-rejected')).toBeNull();
    expect(screen.getByText("Touchez l'arrivée sur la carte")).toBeTruthy();
  });

  it.each([
    ['noRoute', 'Aucun chemin trouvé'],
    ['farFromPath', 'Aucun chemin trouvé'],
    ['engineUnavailable', 'Calcul indisponible'],
    ['zoneUnreadable', 'Zone illisible'],
    ['failed', 'Calcul impossible'],
  ] as const)(
    '%s shows a French message and a way out',
    async (kind, title) => {
      mockComputeRoute.mockResolvedValue({ ok: false, error: kind });
      await renderDraft();
      await addPoints(HAYE, NANCY);
      expect(screen.getByTestId('route-error')).toBeTruthy();
      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.queryByTestId('route-summary')).toBeNull();
      await fireEvent.press(screen.getByText('Retirer ce point'));
      expect(screen.queryByTestId('route-error')).toBeNull();
      expect(screen.getByLabelText('Départ')).toBeTruthy();
    },
  );

  it('the messages are French, not empty, and distinct from one kind to the other', async () => {
    const KINDS = [
      'outOfZone',
      'noRoute',
      'engineUnavailable',
      'zoneUnreadable',
      'failed',
    ] as const;
    const titles: string[] = [];
    const texts: string[] = [];
    for (const kind of KINDS) {
      mockComputeRoute.mockResolvedValue({ ok: false, error: kind });
      await renderDraft();
      await addPoints(HAYE, NANCY);
      const strings: string[] = [];
      const collect = (node: unknown) => {
        const n = node as { children?: unknown[] };
        if (typeof node === 'string') strings.push(node);
        else if (n && Array.isArray(n.children)) n.children.forEach(collect);
      };
      collect(screen.getByTestId('route-error'));
      const visible = strings.filter((s) => s.trim().length > 0);
      expect(visible.length).toBeGreaterThanOrEqual(3); // title, text, button
      titles.push(visible[0] as string);
      texts.push(visible[1] as string);
      expect(screen.getByTestId('route-error-remove')).toBeTruthy();
      await screen.unmount();
    }
    expect(new Set(titles).size).toBe(KINDS.length);
    expect(new Set(texts).size).toBe(KINDS.length);
    for (const s of [...titles, ...texts]) {
      expect(s.length).toBeGreaterThan(5);
      expect(s).not.toMatch(/^route\./); // no raw key
    }
  });

  it('a point outside the rectangle: message, engine not called', async () => {
    await renderDraft();
    await addPoints(OUTSIDE);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('"Retirer ce point" on a first point outside: we can touch again and compute', async () => {
    await renderDraft();
    await addPoints(OUTSIDE);
    await waitForRemoval();
    expect(screen.queryByTestId('route-error')).toBeNull();
    await addPoints(HAYE);
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    await addPoints(NANCY);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('route-summary')).toBeTruthy();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('25,1 km');
  });

  it('after an engine error, "Retirer ce point" allows a new try, computed again', async () => {
    mockComputeRoute.mockResolvedValueOnce({ ok: false, error: 'noRoute' });
    await renderDraft();
    await addPoints(HAYE, NANCY);
    await waitForRemoval();
    await addPoints(NANCY);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('route-summary')).toBeTruthy();
    expect(screen.queryByTestId('route-error')).toBeNull();
  });

  it('a rejected computeRoute does not crash the screen, nor leave it computing', async () => {
    mockComputeRoute.mockRejectedValue(new Error('boom'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    await renderDraft();
    await addPoints(HAYE, NANCY);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    process.off('unhandledRejection', onUnhandled);
    spy.mockRestore();
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.getByText('Calcul impossible')).toBeTruthy();
    expect(unhandled).toEqual([]);
    expect(screen.getByTestId('route-close')).toBeTruthy();
  });
});

// A slow answer must never overwrite a newer state. With "add at the end"
// (ADR 0016, section 1) the old case "the end is replaced" is replaced by:
// the point of the slow leg is removed, another one is added.
describe('port: slow answers and races (RouteCreationT4Testeur)', () => {
  it('only the answer of the legs still on screen is shown', async () => {
    let resolveSlow: (r: RouteResult) => void = () => {};
    mockComputeRoute
      .mockImplementationOnce(
        () => new Promise<RouteResult>((r) => (resolveSlow = r)),
      )
      .mockResolvedValueOnce({ ...SUCCESS, distanceKm: 7.5, durationS: 1200 });
    await renderDraft();
    await addPoints(HAYE, NANCY);
    await pressAnnotation(2);
    await fireEvent.press(screen.getByTestId('route-delete'));
    // A touch on a point blocks the map for 300 ms (guard of the screen).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await addPoints(THIRD);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('7,5 km');
    await act(async () => {
      resolveSlow({ ...SUCCESS, distanceKm: 99, durationS: 99999 });
    });
    await flush();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('7,5 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('20 min');
  });

  it('a slow failure of a leg no longer on screen is ignored', async () => {
    let rejectSlow: (r: RouteResult) => void = () => {};
    mockComputeRoute
      .mockImplementationOnce(
        () => new Promise<RouteResult>((r) => (rejectSlow = r)),
      )
      .mockResolvedValueOnce(SUCCESS);
    await renderDraft();
    await addPoints(HAYE, NANCY);
    await pressAnnotation(2);
    await fireEvent.press(screen.getByTestId('route-delete'));
    // A touch on a point blocks the map for 300 ms (guard of the screen).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await addPoints(THIRD);
    await act(async () => {
      rejectSlow({ ok: false, error: 'noRoute' });
    });
    await flush();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.getByTestId('route-summary')).toBeTruthy();
    expect(screen.getByTestId('route-distance')).toHaveTextContent('25,1 km');
  });
});

describe('port: dotted link (RouteFixT7, B1)', () => {
  it('draws start -> first point and last point -> end, under the route', async () => {
    mockComputeRoute.mockResolvedValue(LINKED);
    await renderDraft();
    await addPoints([6.1, 48.601], [6.12, 48.621]);
    expect(linkFeatures().map((f) => f.geometry.coordinates)).toEqual([
      [
        [6.1, 48.601],
        [6.1, 48.6],
      ],
      [
        [6.12, 48.62],
        [6.12, 48.621],
      ],
    ]);
    const sources = Object.keys(mockSources);
    expect(sources.indexOf('draft-link')).toBeLessThan(
      sources.indexOf('draft-legs'),
    );
    const layers = Object.keys(mockLayers);
    expect(layers.indexOf('draft-link-line')).toBeLessThan(
      layers.indexOf('draft-casing'),
    );
    const paint = mockLayers['draft-link-line'].paint;
    expect(paint['line-color']).toBe('#C2007A');
    expect(paint['line-dasharray']).toEqual([0.1, 2.5]);
    expect(paint['line-width']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      12,
      3 * 0.6,
      15,
      3,
      17,
      3 * 1.3,
    ]);
  });

  it('draws the link at both ends of every leg (3 points: 4 links)', async () => {
    mockComputeRoute.mockResolvedValueOnce(LINKED).mockResolvedValueOnce({
      ok: true,
      shape: [
        [6.12, 48.62],
        [6.14, 48.64],
      ],
      distanceKm: 3,
      durationS: 600,
    });
    await renderDraft();
    await addPoints([6.1, 48.601], [6.12, 48.621], [6.14, 48.641]);
    const links = linkFeatures().map((f) => f.geometry.coordinates);
    expect(links).toHaveLength(4);
    expect(links).toEqual(
      expect.arrayContaining([
        [
          [6.1, 48.601],
          [6.1, 48.6],
        ],
        [
          [6.12, 48.62],
          [6.12, 48.621],
        ],
        [
          [6.12, 48.621],
          [6.12, 48.62],
        ],
        [
          [6.14, 48.64],
          [6.14, 48.641],
        ],
      ]),
    );
  });

  it('draws no link when the points are on the route (< 5 m)', async () => {
    mockComputeRoute.mockResolvedValue(LINKED);
    await renderDraft();
    await addPoints([6.1, 48.6], [6.12, 48.62]);
    expect(linkFeatures()).toHaveLength(0);
  });

  it('draws no link while computing', async () => {
    mockComputeRoute.mockReturnValue(new Promise(() => {}));
    await renderDraft();
    await addPoints([6.1, 48.601], [6.12, 48.621]);
    expect(linkFeatures()).toHaveLength(0);
  });

  it('draws no link for a leg with an error sheet', async () => {
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'noRoute' });
    await renderDraft();
    await addPoints([6.1, 48.601], [6.12, 48.621]);
    expect(screen.getByTestId('route-error')).toBeTruthy();
    expect(linkFeatures()).toHaveLength(0);
  });

  it('keeps all the sources and layers mounted from the opening', async () => {
    await renderDraft();
    expect(Object.keys(mockSources)).toEqual(
      expect.arrayContaining(['draft-link', 'draft-legs', 'draft-preview']),
    );
    const layers = Object.keys(mockLayers);
    for (const id of ['draft-link-line', 'draft-casing', 'draft-line']) {
      expect(layers).toContain(id);
    }
    // From bottom to top: link, casing, line, then the preview of a drag.
    expect(layers.indexOf('draft-casing')).toBeLessThan(
      layers.indexOf('draft-line'),
    );
    expect(layers.indexOf('draft-line')).toBeLessThan(
      layers.indexOf('draft-preview-line'),
    );
  });

  it('puts the link layer under the casing with beforeId', async () => {
    mockComputeRoute.mockResolvedValue(LINKED);
    await renderDraft();
    await addPoints([6.1, 48.601], [6.12, 48.621]);
    expect(mockLayers['draft-link-line'].beforeId).toBe('draft-casing');
  });

  it('keeps the link source mounted when the link goes and comes back', async () => {
    mockComputeRoute.mockResolvedValue(LINKED);
    await renderDraft();
    await addPoints([6.1, 48.601], [6.12, 48.621]);
    expect(linkFeatures()).toHaveLength(2);
    // The engine refuses a point outside the zone (it tests the rectangle).
    mockComputeRoute.mockResolvedValue({ ok: false, error: 'outOfZone' });
    await addPoints([0, 0]); // refused point: error sheet
    expect(screen.getByTestId('route-error')).toBeTruthy();
    // No link reaches the refused point.
    expect(
      linkFeatures().some((f) =>
        f.geometry.coordinates.some((c) => c[0] === 0 && c[1] === 0),
      ),
    ).toBe(false);
    expect(mockSources['draft-link']).toBeDefined();
    expect(mockSources['draft-legs']).toBeDefined();
    // Mounted once, never unmounted and mounted again.
    expect(mockMounts['draft-link']).toBe(1);
    await waitForRemoval();
    expect(linkFeatures()).toHaveLength(2);
    expect(mockLayers['draft-link-line'].beforeId).toBe('draft-casing');
    expect(mockMounts['draft-link']).toBe(1);
  });
});

describe('port: recenter button and camera (RouteFixT7, B2 and B3)', () => {
  it('stays at 60 on the map tab, goes to bar height + 64 in creation', async () => {
    await render(wrap(<MapScreen />));
    await act(async () => {});
    expect(recenterTop()).toBe(60);
    await screen.unmount();
    await renderDraft();
    await fireEvent(screen.getByText('Nouvel itinéraire'), 'layout', {
      nativeEvent: { layout: { height: 112 } },
    });
    expect(recenterTop()).toBe(176);
  });

  it('follows the measured height of the top bar', async () => {
    await renderDraft();
    await fireEvent(screen.getByText('Nouvel itinéraire'), 'layout', {
      nativeEvent: { layout: { height: 130 } },
    });
    expect(recenterTop()).toBe(194);
  });

  it('centers the refused point in the visible part: bar on top, sheet at the bottom', async () => {
    await renderDraft();
    await fireEvent(screen.getByText('Nouvel itinéraire'), 'layout', {
      nativeEvent: { layout: { height: 112 } },
    });
    await addPoints([0, 0]); // outside the zone
    expect(screen.getByTestId('route-error')).toBeTruthy();
    await fireEvent(screen.getByTestId('route-error'), 'layout', {
      nativeEvent: { layout: { height: 310 } },
    });
    expect(mockEaseTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        center: [0, 0],
        padding: { top: 112, bottom: 310, left: 0, right: 0 },
      }),
    );
  });

  it('shows the refused marker and the error sheet together, with the point above the sheet', async () => {
    await renderDraft();
    await fireEvent(screen.getByText('Nouvel itinéraire'), 'layout', {
      nativeEvent: { layout: { height: 112 } },
    });
    await addPoints([0, 0]);
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    await fireEvent(screen.getByTestId('route-error'), 'layout', {
      nativeEvent: { layout: { height: 310 } },
    });
    // The padding keeps the point out of the sheet: it is centered in the
    // part between the bar (112) and the sheet (310).
    expect(mockEaseTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        center: [0, 0],
        padding: { top: 112, bottom: 310, left: 0, right: 0 },
      }),
    );
  });

  it('does not move the camera when the error goes away', async () => {
    await renderDraft();
    await addPoints([0, 0]);
    mockEaseTo.mockClear();
    await waitForRemoval();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });
});
