// "En faire un itinéraire" in the creation (C6 to C9, C11; ADR 0020, sections
// 3 to 6, 9 and 10). Real SQLite and real session; MapLibre, the router and
// the engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { trackLengthM } from '@/core/gpx/trackLengthM';
import { ascentDescent } from '@/core/route-info/elevation';
import nancy from '@/core/routes/fixtures/nancyCircuits.json';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { getRoute, listRoutes } from '@/core/routes/routeRepo';
import type { LonLat } from '@/core/routes/savedRoute';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { nearestOnLine } from '@/core/routes/traceDraft';
import { trailsFile } from '@/core/trails/testing';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftRoot } from './DraftRoot';
import { DraftScreen } from './DraftScreen';
import { useDraftSession } from './DraftSession';
import { setDraftTarget } from './draftTarget';

const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockReadText = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockPrevent: { value: boolean } | undefined;
let mockMapProps: Record<string, any> = {};
let mockDb: Promise<unknown>;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: jest.fn() }));
      return null;
    },
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
    Layer: () => null,
    GeoJSONSource: () => null,
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    ViewAnnotation: (props: { children: ReactNode }) => <>{props.children}</>,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: false, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: (value: boolean) => {
    mockPrevent = { value };
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
const mockInstalled: ReadyMarker[] = [];
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
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: (...args: unknown[]) => mockHeights(...args),
  computeTerrain: (...args: unknown[]) => mockTerrain(...args),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ readText: (...a: unknown[]) => mockReadText(...a) }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 6,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [],
};
mockInstalled.push({
  localFormat: 1,
  installedAt: '2026-11-01T10:00:00.000Z',
  zone,
});

const LITTLE = nancy.circuits[0]; // 21 km, loop, no name
const BIG = nancy.circuits[1]; // 35 km, loop, named
const line = (c: { ordered: unknown }) => c.ordered as LonLat[];

// An altitude that depends on the place only, so that it does not matter
// where a request starts. One profile point per vertex.
const altitude = (p: number[]) =>
  300 + 80 * Math.sin(p[0] * 900) + 60 * Math.cos(p[1] * 700);
function profileOf(shape: LonLat[]) {
  let at = 0;
  return shape.map((p, i) => {
    if (i > 0) at += trackLengthM([shape[i - 1], p]);
    return [at, altitude(p)];
  });
}

type Session = ReturnType<typeof useDraftSession>;
const holder: { current: Session | null } = { current: null };
const session = new Proxy({} as Session, {
  get: (_, key) => (holder.current as never)[key],
});
function Probe() {
  const current = useDraftSession();
  useEffect(() => {
    holder.current = current;
  });
  return null;
}

async function settle() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

type Feature = Parameters<typeof trailsFile>[0][number];
function feature(c: typeof LITTLE, extra: Partial<Feature> = {}): Feature {
  return {
    osm_id: c.osm_id,
    name: c.name,
    length_m: c.ordered_m + 500,
    ordered: c.ordered as [number, number][],
    loop: c.loop,
    ordered_m: c.ordered_m,
    removed_m: 0,
    refusal: null,
    ...extra,
  };
}

async function open(
  osmId: number,
  position: { lon: number; lat: number } | null = null,
) {
  setDraftTarget({ kind: 'trail', osmId, position });
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftRoot>
        <Probe />
        <DraftScreen />
      </DraftRoot>
    </QueryClientProvider>,
  );
  await settle();
}

const act_ = async (fn: () => void) => {
  await act(async () => fn());
  await settle();
};

let db: NodeSqlDb;
beforeEach(async () => {
  jest.clearAllMocks();
  mockPrevent = undefined;
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  mockReadText.mockResolvedValue(trailsFile([feature(LITTLE), feature(BIG)]));
  mockComputeRoute.mockImplementation(async (points: any[]) => ({
    ok: true,
    shape: points.map((p) => [p.lon, p.lat]),
    distanceKm: 1,
    durationS: 300,
  }));
  mockHeights.mockImplementation(async (shape: LonLat[]) => ({
    ok: true,
    profile: profileOf(shape),
  }));
  mockTerrain.mockResolvedValue({
    ok: true,
    edges: [{ use: 'path', density: 1, lengthKm: 1, wayId: 1 }],
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
});
afterEach(() => db.close());

const legsOf = () =>
  session.store.state.draft.points.slice(1).map((p, i) => {
    const from = session.store.state.draft.points[i];
    return session.kept!.get(`${from.lon},${from.lat}>${p.lon},${p.lat}`)!;
  });

describe('C6: the start', () => {
  it('a loop with an unknown position starts at the beginning of the line', async () => {
    await open(BIG.osm_id, null);
    const [first] = session.store.state.draft.points;
    expect([first.lon, first.lat]).toEqual(line(BIG)[0]);
  });

  it('a loop starts at the point nearest to the last known position, and ends there', async () => {
    const p = line(BIG)[400];
    await open(BIG.osm_id, { lon: p[0] + 0.0004, lat: p[1] + 0.0002 });
    const points = session.store.state.draft.points;
    const start = nearestOnLine(line(BIG), [p[0] + 0.0004, p[1] + 0.0002]);
    expect([points[0].lon, points[0].lat]).toEqual(start.point);
    const last = points[points.length - 1];
    expect([last.lon, last.lat]).toEqual(start.point);
    expect(last.id).not.toBe(points[0].id);
  });

  it('a one-way circuit starts at its beginning whatever the position', async () => {
    const way: LonLat[] = [
      [6.0, 48.5],
      [6.01, 48.5],
      [6.02, 48.51],
      [6.03, 48.52],
    ];
    mockReadText.mockResolvedValue(
      trailsFile([
        {
          osm_id: 5,
          name: 'Aller',
          ordered: way,
          loop: false,
          ordered_m: 4000,
          removed_m: 0,
          refusal: null,
        },
      ]),
    );
    await open(5, { lon: 6.03, lat: 48.52 });
    const points = session.store.state.draft.points;
    expect([points[0].lon, points[0].lat]).toEqual(way[0]);
    const last = points[points.length - 1];
    expect([last.lon, last.lat]).toEqual(way[3]);
  });
});

describe.each([LITTLE, BIG])('circuit $osm_id (C7, C11)', (circuit) => {
  it('opens on the trace (1 m, length within 10 m) with no engine calculation', async () => {
    await open(circuit.osm_id);
    const shape = legsOf().flatMap((l) => l.shape as LonLat[]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    // Every point of the legs is on the trace; every vertex is kept.
    const vertices = new Set(shape.map((p) => p.join(',')));
    line(circuit).forEach((v) => expect(vertices.has(v.join(','))).toBe(true));
    const sumM = legsOf().reduce((s, l) => s + l.distanceKm * 1000, 0);
    expect(Math.abs(sumM - circuit.ordered_m)).toBeLessThan(10);
    expect(Math.abs(sumM - trackLengthM(line(circuit)))).toBeLessThan(10);
    expect(legsOf().every((l) => l.trace === true)).toBe(true);
  });

  it('asks the altitudes in one request for the whole line, and the D+ is the one of that request', async () => {
    await open(circuit.osm_id);
    expect(mockHeights).toHaveBeenCalledTimes(1);
    const [asked] = mockHeights.mock.calls[0] as [LonLat[]];
    expect(asked[0]).toEqual(line(circuit)[0]);
    expect(Math.abs(trackLengthM(asked) - circuit.ordered_m)).toBeLessThan(10);
    // Terrain stays by leg.
    expect(mockTerrain).toHaveBeenCalledTimes(legsOf().length);
    const expected = ascentDescent(profileOf(asked).map((p) => p[1])).ascentM;
    // The D+ shown is the one of that single request (C11: same as the trace).
    const digits = String(Math.round(expected)).split('').join('\\D*');
    expect(screen.getByTestId('route-ascent')).toHaveTextContent(
      new RegExp(`^\\D*${digits}\\D*m`),
    );
  });
});

describe('C7: opening', () => {
  it('title = name of the circuit, bubble 4 s, announcement, Enregistrer open, closing asks nothing', async () => {
    await open(BIG.osm_id);
    expect(
      screen.getByRole('header', { name: 'Petite Suisse Lorraine à VTT' }),
    ).toBeTruthy();
    expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
      'Tracé du circuit posé. Déplacez un point pour le modifier.',
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      expect.stringContaining('Petite Suisse Lorraine à VTT'),
    );
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: false,
    });
    expect(mockPrevent?.value).toBe(false);
  });

  it('the bubble goes away at the first touch on the map', async () => {
    await open(BIG.osm_id);
    await act_(() =>
      mockMapProps.onPress({ nativeEvent: { lngLat: [6, 48.6] } }),
    );
    expect(screen.queryByTestId('trail-bubble')).toBeNull();
  });

  it('the middle points are round without number until the zoom is close', async () => {
    await open(BIG.osm_id);
    const rounds = () =>
      screen.queryAllByTestId('draft-marker-discrete').length;
    await act_(() =>
      mockMapProps.onRegionDidChange({ nativeEvent: { zoom: 11 } }),
    );
    const points = session.store.state.draft.points.length;
    expect(rounds()).toBe(points - 2);
    await act_(() =>
      mockMapProps.onRegionDidChange({ nativeEvent: { zoom: 16 } }),
    );
    expect(rounds()).toBe(0);
  });

  it('a circuit that is gone closes the creation with a message', async () => {
    mockReadText.mockResolvedValue(trailsFile([]));
    await open(BIG.osm_id);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Circuit introuvable',
      expect.any(String),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('a part outside the zone: no point there, the 6 s bubble says it', async () => {
    const out: LonLat[] = [
      [6.3, 48.8],
      [6.4, 48.8],
      [6.5, 48.8],
      [6.6, 48.8],
      [6.7, 48.8],
      [6.5, 48.8],
      [6.3, 48.8],
    ];
    mockReadText.mockResolvedValue(
      trailsFile([
        {
          osm_id: 6,
          name: 'Sortie',
          ordered: out,
          loop: true,
          ordered_m: 60000,
          removed_m: 0,
          refusal: null,
        },
      ]),
    );
    await open(6);
    expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
      /^Une partie du tracé sort de la zone\./,
    );
    expect(mockHeights).not.toHaveBeenCalled();
    const inside = session.store.state.draft.points.filter(
      (p) => p.lon > zone.bbox.lonMax,
    );
    // Only an end may be outside the rectangle.
    expect(inside.length).toBeLessThanOrEqual(2);
  });
});

describe('C8: modifying', () => {
  it('moving a point calculates only the two legs next to it, "Annuler" gets the trace back', async () => {
    await open(BIG.osm_id);
    const before = session.store.state.draft;
    const heightsBefore = mockHeights.mock.calls.length;
    const id = before.points[5].id;
    const p = before.points[5];
    await act_(() =>
      session.dispatch({ type: 'move', id, lon: p.lon + 0.001, lat: p.lat }),
    );
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    // Groups: before, the two new legs, after (4 requests at most more).
    expect(mockHeights.mock.calls.length - heightsBefore).toBe(4);
    await act_(() => session.dispatch({ type: 'undo' }));
    expect(session.store.state.draft).toBe(before);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(mockHeights.mock.calls.length - heightsBefore).toBe(4);
  });
});

describe('C9: "Enregistrer"', () => {
  it('keeps the route with origin "circuit balisé", the name of the circuit and trace legs', async () => {
    await open(BIG.osm_id);
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const [row] = await listRoutes(db);
    expect(row).toMatchObject({
      name: 'Petite Suisse Lorraine à VTT',
      origin: 'trail',
    });
    const route = await getRoute(db, row!.id);
    expect(
      route &&
        'legs' in route &&
        route.legs.every((l) => l.mode === 'path' && l.trace),
    ).toBe(true);
    expect(mockPush).toHaveBeenCalledWith(`/route/${row!.id}`);
  });

  it('numbers the second one "(2)"', async () => {
    await open(BIG.osm_id);
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    holder.current = null;
    await open(BIG.osm_id);
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const names = (await listRoutes(db)).map((r) => r.name).sort();
    expect(names).toEqual([
      'Petite Suisse Lorraine à VTT',
      'Petite Suisse Lorraine à VTT (2)',
    ]);
  });

  it('a circuit with neither name nor number is "Circuit du 9 nov."', async () => {
    await open(LITTLE.osm_id);
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const [row] = await listRoutes(db);
    expect(row!.name).toMatch(/^Circuit du \d+ /);
  });

  it('a route of origin "trail" reopened keeps its origin when saved again', async () => {
    await open(BIG.osm_id);
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const [row] = await listRoutes(db);
    holder.current = null;
    setDraftTarget({ kind: 'route', id: row!.id });
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <DraftRoot>
          <Probe />
          <DraftScreen />
        </DraftRoot>
      </QueryClientProvider>,
    );
    await settle();
    const p = session.store.state.draft.points[3];
    await act_(() =>
      session.dispatch({
        type: 'move',
        id: p.id,
        lon: p.lon + 0.001,
        lat: p.lat,
      }),
    );
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const rows = await listRoutes(db);
    expect(rows).toHaveLength(1);
    expect(rows.find((r) => r.id === row!.id)!.origin).toBe('trail');
  });
});
