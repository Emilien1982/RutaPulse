// T9, M6: the creation opens already framed on the circuit (no flight over
// the zone or the position first). Same fakes as TrailDraftT5b.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { trackLengthM } from '@/core/gpx/trackLengthM';
import nancy from '@/core/routes/fixtures/nancyCircuits.json';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import type { LonLat } from '@/core/routes/savedRoute';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
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
let mockCameraProps: Record<string, any> = {};
let mockDb: Promise<unknown>;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> } & Record<string, any>) => {
      mockCameraProps = props;
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
  usePreventRemove: () => {},
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

let db: NodeSqlDb;
beforeEach(async () => {
  jest.clearAllMocks();
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

describe('M6: the camera opens on the circuit', () => {
  it('starts on the center and zoom of the circuit, not on the whole zone', async () => {
    await open(BIG.osm_id);
    const view = mockCameraProps.initialViewState;
    expect(view.bounds).toBeUndefined();
    const lons = line(BIG).map((p) => p[0]);
    const lats = line(BIG).map((p) => p[1]);
    expect(view.center[0]).toBeCloseTo(
      (Math.min(...lons) + Math.max(...lons)) / 2,
      5,
    );
    expect(view.center[1]).toBeCloseTo(
      (Math.min(...lats) + Math.max(...lats)) / 2,
      5,
    );
    // 35 km on a phone: far from the zoom 15 of an empty creation.
    expect(view.zoom).toBeGreaterThan(8);
    expect(view.zoom).toBeLessThan(13);
  });
});
