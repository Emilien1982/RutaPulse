// "Modifier" of a GPX in the creation (C10, C7, C11; ADR 0020, sections 5, 7,
// 8 and 10). Real SQLite and real session; MapLibre, the router and the
// engine are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { trackLengthM } from '@/core/gpx/trackLengthM';
import nancy from '@/core/routes/fixtures/nancyCircuits.json';
import { sampleGpx } from '@/core/routes/testing/sampleRoutes';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { getRoute, insertRoute, listRoutes } from '@/core/routes/routeRepo';
import type { LonLat } from '@/core/routes/savedRoute';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
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

const BIG = nancy.circuits[1]; // 35 km, loop
const TRACK = BIG.ordered as LonLat[];
const ZONE_REF = { id: 'nancy', version: 5, name: 'Nancy' };

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

async function open(target: Parameters<typeof setDraftTarget>[0]) {
  holder.current = null;
  setDraftTarget(target);
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
  mockReadText.mockResolvedValue('{}');
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

async function insertGpx(track: LonLat[], patch = {}) {
  return insertRoute(
    db,
    sampleGpx({
      name: 'Ma sortie',
      zone: ZONE_REF,
      track,
      elevations: track.map(() => 250),
      distanceKm: trackLengthM(track) / 1000,
      ...patch,
    }),
  );
}

const legsOf = () =>
  session.store.state.draft.points.slice(1).map((p, i) => {
    const from = session.store.state.draft.points[i];
    return session.kept!.get(`${from.lon},${from.lat}>${p.lon},${p.lat}`)!;
  });

const moveOne = () => {
  const p = session.store.state.draft.points[3];
  return act_(() =>
    session.dispatch({
      type: 'move',
      id: p.id,
      lon: p.lon + 0.001,
      lat: p.lat,
    }),
  );
};

describe('C10 / C7: opening a GPX', () => {
  it('title = name of the GPX, tracks as a circuit, no engine calculation, one altitude request', async () => {
    const id = await insertGpx(TRACK);
    await open({ kind: 'gpx', id });
    expect(screen.getByRole('header', { name: 'Ma sortie' })).toBeTruthy();
    const shape = legsOf().flatMap((l) => l.shape as LonLat[]);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    const vertices = new Set(shape.map((p) => p.join(',')));
    TRACK.forEach((v) => expect(vertices.has(v.join(','))).toBe(true));
    const sumM = legsOf().reduce((s, l) => s + l.distanceKm * 1000, 0);
    expect(Math.abs(sumM - trackLengthM(TRACK))).toBeLessThan(10);
    expect(legsOf().every((l) => l.trace === true)).toBe(true);
    expect(mockHeights).toHaveBeenCalledTimes(1);
    // One-way, from the beginning: the first and last points are the ends.
    const points = session.store.state.draft.points;
    expect([points[0].lon, points[0].lat]).toEqual(TRACK[0]);
    const last = points[points.length - 1];
    expect([last.lon, last.lat]).toEqual(TRACK[TRACK.length - 1]);
  });

  it('keeps 10 000 points of a file to 1 m and the length to 10 m', async () => {
    // 10 000 points over about 13 km, wavy, inside the zone.
    // Six decimals, like a file.
    const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
    const big: LonLat[] = Array.from({ length: 10_000 }, (_, i) => [
      r6(6.1 + i * 0.00002 + 0.0003 * Math.sin(i / 40)),
      r6(48.6 + i * 0.000011 + 0.0004 * Math.cos(i / 55)),
    ]);
    const id = await insertGpx(big);
    await open({ kind: 'gpx', id });
    const shape = legsOf().flatMap((l) => l.shape as LonLat[]);
    const keys = new Set(shape.map((p) => p.join(',')));
    expect(big.every((v) => keys.has(v.join(',')))).toBe(true);
    const sumM = legsOf().reduce((s, l) => s + l.distanceKm * 1000, 0);
    expect(Math.abs(sumM - trackLengthM(big))).toBeLessThan(10);
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(session.store.state.draft.points.length).toBeLessThanOrEqual(51);
  });

  it('Enregistrer is closed and closing asks nothing, until a change', async () => {
    const id = await insertGpx(TRACK);
    await open({ kind: 'gpx', id });
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(mockPrevent?.value).toBe(false);
    await moveOne();
    expect(mockPrevent?.value).toBe(true);
  });

  it('the bubble says the saving replaces the original, and goes at the first touch', async () => {
    const id = await insertGpx(TRACK);
    await open({ kind: 'gpx', id });
    expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
      "Tracé du GPX posé. En enregistrant, vous remplacez l'original.",
    );
    await act_(() =>
      mockMapProps.onPress({ nativeEvent: { lngLat: [6, 48.6] } }),
    );
    expect(screen.queryByTestId('trail-bubble')).toBeNull();
  });

  it('a GPX that is gone closes with a message', async () => {
    await open({ kind: 'gpx', id: 99 });
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('a GPX of another zone closes with a message', async () => {
    const other = await insertGpx(TRACK, {
      zone: { id: 'metz', version: 1, name: 'Metz' },
    });
    await open({ kind: 'gpx', id: other });
    expect(Alert.alert).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('C10 / ADR 0020, section 5: a GPX that leaves the zone', () => {
  const OUT: LonLat[] = [
    [6.3, 48.8],
    [6.4, 48.8],
    [6.5, 48.8],
    [6.6, 48.8],
    [6.7, 48.8],
  ];

  it('keeps one trace leg for the part outside, and says so after the first bubble', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      const id = await insertGpx(OUT);
      await open({ kind: 'gpx', id });
      expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
        /^Tracé du GPX posé/,
      );
      await act(async () => {
        jest.advanceTimersByTime(5500);
      });
      expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
        /^Tracé du GPX posé/,
      );
      await act(async () => {
        jest.advanceTimersByTime(700);
      });
      expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
        /^Une partie du tracé sort de la zone\./,
      );
      await act(async () => {
        jest.advanceTimersByTime(6200);
      });
      expect(screen.queryByTestId('trail-bubble')).toBeNull();
      expect(mockHeights).not.toHaveBeenCalled();
      expect(mockComputeRoute).not.toHaveBeenCalled();
      expect(legsOf().every((l) => l.trace === true)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('C10: "Enregistrer"', () => {
  it('with a change: one UPDATE to editedGpx, same row, then back to its screen', async () => {
    const id = await insertGpx(TRACK);
    const before = (await getRoute(db, id))!;
    await open({ kind: 'gpx', id });
    await moveOne();
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const rows = await listRoutes(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      name: 'Ma sortie',
      origin: 'editedGpx',
    });
    const after = (await getRoute(db, id))!;
    expect(after.readable && after.origin).toBe('editedGpx');
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.savedAt).toBeGreaterThan(before.savedAt);
    expect(after.zone).toMatchObject({ id: 'nancy', version: 6 });
    expect('track' in after).toBe(false);
    const raw = await db.first<{ track: unknown; elevations: unknown }>(
      'SELECT track, elevations FROM routes WHERE id = ?',
      [id],
    );
    expect(raw).toEqual({ track: null, elevations: null });
    // Back to the Infos screen below, which reads the row again. The creation
    // does not take the edited row for a missing GPX (no message, one back).
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('without a change: nothing is written, the GPX keeps its file altitudes', async () => {
    const id = await insertGpx(TRACK);
    const before = await db.first('SELECT * FROM routes WHERE id = ?', [id]);
    await open({ kind: 'gpx', id });
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    expect(await db.first('SELECT * FROM routes WHERE id = ?', [id])).toEqual(
      before,
    );
    // Moving a point and undoing it is no change either.
    await moveOne();
    await act_(() => session.dispatch({ type: 'undo' }));
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(mockPrevent?.value).toBe(false);
    expect(await db.first('SELECT * FROM routes WHERE id = ?', [id])).toEqual(
      before,
    );
  });

  it('closing with changes asks "Abandonner les changements ?" and the GPX stays intact', async () => {
    const id = await insertGpx(TRACK);
    const before = await db.first('SELECT * FROM routes WHERE id = ?', [id]);
    await open({ kind: 'gpx', id });
    await moveOne();
    expect(mockPrevent?.value).toBe(true);
    expect(await db.first('SELECT * FROM routes WHERE id = ?', [id])).toEqual(
      before,
    );
    const route = (await getRoute(db, id))!;
    expect(route.readable && route.origin).toBe('gpx');
  });

  it('an edited GPX reopened by "Modifier" keeps its origin when saved again', async () => {
    const id = await insertGpx(TRACK);
    await open({ kind: 'gpx', id });
    await moveOne();
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const first = (await getRoute(db, id))!;
    jest.clearAllMocks();
    holder.current = null;
    await act(async () => screen.unmount());
    await open({ kind: 'route', id });
    expect(mockComputeRoute).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-save').props.accessibilityState).toEqual({
      disabled: true,
    });
    const p = session.store.state.draft.points[5];
    await act_(() =>
      session.dispatch({
        type: 'move',
        id: p.id,
        lon: p.lon,
        lat: p.lat + 0.001,
      }),
    );
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));
    const rows = await listRoutes(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.origin).toBe('editedGpx');
    expect((await getRoute(db, id))!.savedAt).toBeGreaterThanOrEqual(
      first.savedAt,
    );
  });
});
