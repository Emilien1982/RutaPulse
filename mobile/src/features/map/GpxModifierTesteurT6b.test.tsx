// Tests written by the tester from the spec (docs/phases/p07-circuits-balises.md,
// C10 and C11) and ADR 0020 sections 5, 6 and 8 -- not from the code.
// Real SQLite (node:sqlite), the real Infos screen and the real creation;
// MapLibre, the router, the engine and the altitudes are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { trackLengthM } from '@/core/gpx/trackLengthM';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { getRoute, insertRoute, listRoutes } from '@/core/routes/routeRepo';
import type { LonLat } from '@/core/routes/savedRoute';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftRoot } from './DraftRoot';
import { DraftScreen } from './DraftScreen';
import { useDraftSession } from './DraftSession';
import { setDraftTarget } from './draftTarget';
import { SavedRouteInfoScreen } from './SavedRouteInfoScreen';

const mockComputeRoute = jest.fn();
const mockHeights = jest.fn();
const mockTerrain = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockPrevent: { value: boolean; cb?: (e: any) => void } | undefined;
const mockAnnotations: Record<string, any> = {};
let mockMapProps: Record<string, any> = {};
let mockDb: Promise<unknown>;
let mockId = '1';

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
    ViewAnnotation: (props: { id: string; children: ReactNode }) => {
      mockAnnotations[props.id] = props;
      return <>{props.children}</>;
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
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    dismissTo: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: mockId }),
  usePreventRemove: (value: boolean, cb: (e: any) => void) => {
    mockPrevent = { value, cb };
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
  createZoneOps: () => ({ readText: async () => '{}' }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 5,
  bbox: { lonMin: 6.1, latMin: 48.6, lonMax: 6.3, latMax: 48.8 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [],
};
mockInstalled.push({
  localFormat: 1,
  installedAt: '2026-11-01T10:00:00.000Z',
  zone,
});
const ZONE_REF = { id: 'nancy', version: 5, name: 'Nancy' };
const inZone = (p: LonLat) =>
  p[0] >= zone.bbox.lonMin &&
  p[0] <= zone.bbox.lonMax &&
  p[1] >= zone.bbox.latMin &&
  p[1] <= zone.bbox.latMax;

// Simulated altitudes: a function of the position only, so that any way of
// asking (whole track, or leg by leg) sees the same ground.
const altitude = (p: number[]) =>
  300 + 80 * Math.sin(p[0] * 900) + 60 * Math.cos(p[1] * 700);
function profileOf(shape: LonLat[]) {
  let at = 0;
  return shape.map((p, i) => {
    if (i > 0) at += trackLengthM([shape[i - 1], p]);
    return [at, altitude(p)];
  });
}
/** Ascent of a profile as the spec defines D+: sum of the climbs. */
function rawAscent(profile: number[][]) {
  let up = 0;
  for (let i = 1; i < profile.length; i++) {
    up += Math.max(0, profile[i][1] - profile[i - 1][1]);
  }
  return up;
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
  for (let i = 0; i < 12; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
const wrap = (children: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);
async function openInfos(id: number) {
  mockId = String(id);
  await render(wrap(<SavedRouteInfoScreen />));
  await settle();
}
async function openDraft(target: Parameters<typeof setDraftTarget>[0]) {
  holder.current = null;
  setDraftTarget(target);
  await render(
    wrap(
      <DraftRoot>
        <Probe />
        <DraftScreen />
      </DraftRoot>,
    ),
  );
  await settle();
}
const act_ = async (fn: () => void) => {
  await act(async () => fn());
  await settle();
};
/** Number of metres in "850 m" / "3,2 km" (figures are written in French). */
function metres(text: string) {
  const n = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
  return /km/.test(text) ? n * 1000 : n;
}
const text = (id: string) => {
  const node = screen.getByTestId(id);
  const flat = (c: any): string =>
    typeof c === 'string' || typeof c === 'number'
      ? String(c)
      : Array.isArray(c)
        ? c.map(flat).join('')
        : c?.props?.children !== undefined
          ? flat(c.props.children)
          : '';
  return flat(node.props.children);
};

let db: NodeSqlDb;
beforeEach(async () => {
  jest.clearAllMocks();
  mockPrevent = undefined;
  setDraftTarget(null);
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
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

/** A wavy GPX of `n` points that stays inside the zone. */
function wavy(n: number, step: number): LonLat[] {
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  return Array.from({ length: n }, (_, i) => [
    r6(6.12 + i * step + 0.0004 * Math.sin(i / 7)),
    r6(48.62 + i * step * 0.55 + 0.0004 * Math.cos(i / 9)),
  ]);
}
async function insertGpx(track: LonLat[], patch = {}) {
  return insertRoute(
    db,
    sampleGpx({
      name: 'Ma sortie',
      zone: ZONE_REF,
      track,
      elevations: null,
      distanceKm: trackLengthM(track) / 1000,
      ...patch,
    } as never),
  );
}

describe('C11: same distance (10 m) and D+ (5 m) on the Infos screen and in the creation', () => {
  // Short enough to be written in metres (no rounding to 100 m).
  it.each([
    ['short wavy GPX, 60 points', wavy(60, 0.00009)],
    ['short wavy GPX, 200 points', wavy(200, 0.00003)],
  ])('%s', async (_name, track) => {
    expect(trackLengthM(track)).toBeLessThan(990);
    const id = await insertGpx(track);

    await openInfos(id);
    const infoDistance = metres(text('info-distance'));
    const infoAscent = metres(text('info-ascent'));
    await act(async () => screen.unmount());

    mockHeights.mockClear();
    await openDraft({ kind: 'gpx', id });
    const draftDistance = metres(text('route-distance'));
    const draftAscent = metres(text('route-ascent'));

    expect(Math.abs(draftDistance - infoDistance)).toBeLessThanOrEqual(10);
    expect(Math.abs(draftAscent - infoAscent)).toBeLessThanOrEqual(5);
    // Both are also close to the value of the file itself.
    expect(Math.abs(draftDistance - trackLengthM(track))).toBeLessThanOrEqual(
      10,
    );
    expect(Math.abs(infoAscent - rawAscent(profileOf(track)))).toBeLessThan(
      200,
    );
  });

  it('long GPX (10 km): distance equal to 10 m by the legs, D+ equal to 5 m', async () => {
    const track = wavy(400, 0.0003);
    const id = await insertGpx(track);
    await openInfos(id);
    const infoAscent = metres(text('info-ascent'));
    const infoKm = metres(text('info-distance'));
    await act(async () => screen.unmount());

    await openDraft({ kind: 'gpx', id });
    const draftAscent = metres(text('route-ascent'));
    const draftKm = metres(text('route-distance'));
    const pts = session.store.state.draft.points;
    const sumM = pts.slice(1).reduce((s, p, i) => {
      const from = pts[i];
      const leg = session.kept!.get(
        `${from.lon},${from.lat}>${p.lon},${p.lat}`,
      )!;
      return s + leg.distanceKm * 1000;
    }, 0);
    expect(Math.abs(sumM - trackLengthM(track))).toBeLessThanOrEqual(10);
    // Texts are written to 0.1 km: they cannot differ by more than that.
    expect(Math.abs(draftKm - infoKm)).toBeLessThanOrEqual(100);
    expect(Math.abs(draftAscent - infoAscent)).toBeLessThanOrEqual(5);
  });

  it('general case with an outside reference: a constant 3 % slope gives D+ = 0.03 x length', async () => {
    // Reference outside the code: on a straight climb of constant grade g,
    // the ascent is g x length (plain geometry). 800 m at 3 % = 24 m.
    const track: LonLat[] = Array.from({ length: 41 }, (_, i) => [
      6.15 + i * 0.00025,
      48.65,
    ]);
    const length = trackLengthM(track);
    mockHeights.mockImplementation(async (shape: LonLat[]) => {
      let at = 0;
      return {
        ok: true,
        profile: shape.map((p, i) => {
          if (i > 0) at += trackLengthM([shape[i - 1], p]);
          return [at, 100 + 0.03 * trackLengthM([track[0], p])];
        }),
      };
    });
    const id = await insertGpx(track);
    await openInfos(id);
    const infoAscent = metres(text('info-ascent'));
    await act(async () => screen.unmount());
    await openDraft({ kind: 'gpx', id });
    const draftAscent = metres(text('route-ascent'));
    const expected = 0.03 * length;
    expect(Math.abs(infoAscent - expected)).toBeLessThanOrEqual(5);
    expect(Math.abs(draftAscent - expected)).toBeLessThanOrEqual(5);
  });
});

describe('C10: availability of "Modifier"', () => {
  it('a GPX entirely outside the zones: no button, a message with "Voir les zones"', async () => {
    const id = await insertGpx(
      [
        [2.3, 48.85],
        [2.31, 48.86],
        [2.32, 48.87],
      ],
      { zone: null },
    );
    await openInfos(id);
    expect(screen.queryByTestId('info-modify')).toBeNull();
    expect(screen.getByTestId('info-see-zones')).toBeTruthy();
  });

  it('a GPX inside the zone has the button', async () => {
    const id = await insertGpx(wavy(30, 0.0001));
    await openInfos(id);
    expect(screen.getByTestId('info-modify')).toBeTruthy();
  });
});

describe('C10: "Enregistrer" and abandon on a real SQLite', () => {
  const COLUMNS = 'SELECT * FROM routes WHERE id = ?';

  it('after a change: "GPX modifié le", same id, same name, same created_at', async () => {
    const track = wavy(400, 0.0003);
    const id = await insertGpx(track, { name: 'Ma sortie', createdAt: 1_000 });
    const before = (await db.first<Record<string, unknown>>(COLUMNS, [id]))!;
    await openInfos(id);
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /GPX importé le/,
    );
    await act(async () => screen.unmount());

    await openDraft({ kind: 'gpx', id });
    const p = session.store.state.draft.points[1];
    await act_(() =>
      session.dispatch({
        type: 'move',
        id: p.id,
        lon: p.lon + 0.0005,
        lat: p.lat,
      }),
    );
    await act_(() => fireEvent.press(screen.getByTestId('route-save')));

    const rows = await listRoutes(db);
    expect(rows).toHaveLength(1);
    const after = (await db.first<Record<string, unknown>>(COLUMNS, [id]))!;
    expect(after.id).toBe(before.id);
    expect(after.name).toBe('Ma sortie');
    expect(after.created_at).toBe(before.created_at);
    expect(after.origin).toBe('editedGpx');
    expect(after.saved_at as number).toBeGreaterThan(before.saved_at as number);

    await act(async () => screen.unmount());
    await openInfos(id);
    expect(screen.getByTestId('info-title')).toHaveTextContent('Ma sortie');
    expect(screen.getByTestId('info-subtitle')).toHaveTextContent(
      /GPX modifié le/,
    );
  });

  it('abandon: the dialog is shown, confirming leaves the row identical column by column', async () => {
    const track = wavy(400, 0.0003);
    const id = await insertGpx(track);
    const before = await db.first(COLUMNS, [id]);
    await openDraft({ kind: 'gpx', id });
    const p = session.store.state.draft.points[1];
    await act_(() =>
      session.dispatch({
        type: 'move',
        id: p.id,
        lon: p.lon + 0.0005,
        lat: p.lat,
      }),
    );
    expect(mockPrevent?.value).toBe(true);
    const repeat = jest.fn();
    await act(async () => mockPrevent!.cb!({ repeat }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    await act(async () =>
      buttons.find((b) => b.text === 'Abandonner')!.onPress!(),
    );
    expect(repeat).toHaveBeenCalled();
    expect(await db.first(COLUMNS, [id])).toEqual(before);
    const row = (await getRoute(db, id))!;
    expect(row.readable && row.origin).toBe('gpx');
  });
});

describe('ADR 0020 section 5: a GPX that leaves the zone', () => {
  // Three points inside, then three outside (east of 6.3).
  const LEAVING: LonLat[] = [
    [6.2, 48.7],
    [6.22, 48.7],
    [6.24, 48.7],
    [6.32, 48.7],
    [6.34, 48.7],
    [6.36, 48.7],
  ];
  // Inside, out for a while, and back inside.
  const EXCURSION: LonLat[] = [
    [6.2, 48.7],
    [6.22, 48.7],
    [6.32, 48.7],
    [6.34, 48.7],
    [6.36, 48.7],
    [6.25, 48.71],
    [6.23, 48.71],
  ];

  const legShapes = () => {
    const pts = session.store.state.draft.points;
    return pts.slice(1).map((p, i) => {
      const from = pts[i];
      return session.kept!.get(`${from.lon},${from.lat}>${p.lon},${p.lat}`)!;
    });
  };

  it('the outside part is one kept leg; no waypoint is posed outside except the end', async () => {
    const id = await insertGpx(LEAVING);
    await openDraft({ kind: 'gpx', id });
    const pts = session.store.state.draft.points;
    const outsidePoints = pts.filter((p) => !inZone([p.lon, p.lat]));
    // Only the arrival (an end of the trace) may be outside.
    expect(outsidePoints).toHaveLength(1);
    expect(outsidePoints[0]).toBe(pts[pts.length - 1]);
    const legs = legShapes();
    const outLegs = legs.filter((l) =>
      (l.shape as LonLat[]).some((v) => !inZone(v)),
    );
    expect(outLegs).toHaveLength(1);
    expect(outLegs[0].trace).toBe(true);
    // The whole outside tail is in that one leg, in order.
    const shape = outLegs[0].shape as LonLat[];
    [LEAVING[3], LEAVING[4], LEAVING[5]].forEach((v) =>
      expect(shape.some((q) => q[0] === v[0] && q[1] === v[1])).toBe(true),
    );
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('out and back in: no waypoint outside at all, one kept leg holds the excursion', async () => {
    const id = await insertGpx(EXCURSION);
    await openDraft({ kind: 'gpx', id });
    const pts = session.store.state.draft.points;
    expect(pts.every((p) => inZone([p.lon, p.lat]))).toBe(true);
    const outLegs = legShapes().filter((l) =>
      (l.shape as LonLat[]).some((v) => !inZone(v)),
    );
    expect(outLegs).toHaveLength(1);
    const shape = outLegs[0].shape as LonLat[];
    [EXCURSION[2], EXCURSION[3], EXCURSION[4]].forEach((v) =>
      expect(shape.some((q) => q[0] === v[0] && q[1] === v[1])).toBe(true),
    );
  });

  it('the outside bubble comes after the first one, when nothing is touched', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      const id = await insertGpx(LEAVING);
      await openDraft({ kind: 'gpx', id });
      expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
        /^Tracé du GPX posé/,
      );
      await act(async () => {
        jest.advanceTimersByTime(6200);
      });
      expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
        /^Une partie du tracé sort de la zone/,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  // ADR 0020 section 5: the bubble of the outside part comes "after" the first
  // one. A touch removes the bubble shown, not the whole queue.
  it('a touch during the first bubble still leaves the outside bubble to come', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      const id = await insertGpx(LEAVING);
      await openDraft({ kind: 'gpx', id });
      await act(async () =>
        mockMapProps.onPress({ nativeEvent: { lngLat: [6.2, 48.65] } }),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      // Expected by the spec: the outside bubble is shown at some point.
      expect(screen.getByTestId('trail-bubble')).toHaveTextContent(
        /^Une partie du tracé sort de la zone/,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  // One touch removes one bubble, whatever the order of the events (iOS can
  // report the map before the point, and a drag has a start and an end).
  const OUTSIDE = /^Une partie du tracé sort de la zone/;
  const pointId = () => `draft-point-${session.store.state.draft.points[1].id}`;
  const later = (ms: number) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });

  it('a touch on the map then on a point removes one bubble, not two', async () => {
    const id = await insertGpx(LEAVING);
    await openDraft({ kind: 'gpx', id });
    await act(async () =>
      mockMapProps.onPress({ nativeEvent: { lngLat: [6.2, 48.65] } }),
    );
    await act(async () => mockAnnotations[pointId()].onPress());
    expect(screen.getByTestId('trail-bubble')).toHaveTextContent(OUTSIDE);
  });

  it('a whole drag removes one bubble, not two', async () => {
    const id = await insertGpx(LEAVING);
    await openDraft({ kind: 'gpx', id });
    const at = mockAnnotations[pointId()].lngLat as [number, number];
    const event = { nativeEvent: { lngLat: at } };
    await act(async () => mockAnnotations[pointId()].onDragStart(event));
    await later(400);
    await act(async () => mockAnnotations[pointId()].onDragEnd(event));
    expect(screen.getByTestId('trail-bubble')).toHaveTextContent(OUTSIDE);
  });
});
