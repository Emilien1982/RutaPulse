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
import { listRoutes } from '@/core/routes/routeRepo';
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
let mockDb: Promise<unknown>;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
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

// Tests written from the spec (C6 to C9, C11), not from the code.
describe('Testeur C8: delete and add recalculate only what is touched', () => {
  it('deleting a middle point recalculates one leg (the one joining its neighbours)', async () => {
    await open(BIG.osm_id);
    const legsBefore = legsOf().length;
    const id = session.store.state.draft.points[7].id;
    await act_(() => session.dispatch({ type: 'remove', id }));
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(mockComputeRoute.mock.calls.length).toBeLessThan(legsBefore);
    expect(legsOf().length).toBe(legsBefore - 1);
  });

  it('adding a point calculates at most two legs, never the whole trace', async () => {
    await open(BIG.osm_id);
    const legsBefore = legsOf().length;
    const p = session.store.state.draft.points[10];
    await act_(() =>
      session.dispatch({ type: 'add', lon: p.lon + 0.0005, lat: p.lat }),
    );
    expect(mockComputeRoute.mock.calls.length).toBeLessThanOrEqual(2);
    expect(mockComputeRoute.mock.calls.length).toBeLessThan(legsBefore);
  });

  it('after a change the closing is guarded; after "Annuler" (undo) it is free again', async () => {
    await open(BIG.osm_id);
    expect(mockPrevent?.value).toBe(false);
    const p = session.store.state.draft.points[4];
    await act_(() =>
      session.dispatch({
        type: 'move',
        id: p.id,
        lon: p.lon + 0.001,
        lat: p.lat,
      }),
    );
    expect(mockPrevent?.value).toBe(true);
    await act_(() => session.dispatch({ type: 'undo' }));
    expect(mockPrevent?.value).toBe(false);
  });
});

describe.each([LITTLE, BIG])('Testeur C7 and C11 on circuit $osm_id', (c) => {
  it('every point of the trace is within 1 m of the circuit line and the length within 10 m of the factory length', async () => {
    await open(c.osm_id);
    const shape = legsOf().flatMap((l) => l.shape as LonLat[]);
    const lineStr = line(c);
    // External source: ordered_m was measured by the zone factory (Python),
    // independently of the app.
    const sumM = legsOf().reduce((s, l) => s + l.distanceKm * 1000, 0);
    expect(Math.abs(sumM - c.ordered_m)).toBeLessThan(10);
    for (const p of shape.filter((_, i) => i % 7 === 0)) {
      expect(trackLengthM([p, nearestOnLine(lineStr, p).point])).toBeLessThan(
        1,
      );
    }
  });

  it('the D+ shown is within 5 m of the D+ of the whole line', async () => {
    // A slow altitude (hills, not noise), so that the sampling of the
    // request cannot change the D+ of the line.
    const smooth = (p: number[]) =>
      300 + 120 * Math.sin(p[0] * 60) + 90 * Math.cos(p[1] * 50);
    const smoothProfile = (shape: LonLat[]) => {
      let at = 0;
      return shape.map((p, i) => {
        if (i > 0) at += trackLengthM([shape[i - 1], p]);
        return [at, smooth(p)];
      });
    };
    mockHeights.mockImplementation(async (shape: LonLat[]) => ({
      ok: true,
      profile: smoothProfile(shape),
    }));
    await open(c.osm_id);
    const whole = ascentDescent(
      smoothProfile(line(c)).map((p) => p[1]),
    ).ascentM;
    const alts: string[] = [];
    for (let v = Math.round(whole) - 5; v <= Math.round(whole) + 5; v++) {
      alts.push(String(v).split('').join('\\D*'));
    }
    expect(screen.getByTestId('route-ascent')).toHaveTextContent(
      new RegExp(`^\\D*(${alts.join('|')})\\D*m`),
    );
  });

  it('saved: origin "trail", read back with its trace legs, list text "circuit balisé"', async () => {
    await open(c.osm_id);
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const rows = await listRoutes(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.origin).toBe('trail');
    const raw = await db.first<{ origin: string; user_version?: number }>(
      'SELECT origin FROM routes',
    );
    expect(raw!.origin).toBe('trail');
    const v = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(v!.user_version).toBe(2);
  });
});
