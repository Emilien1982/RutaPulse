// Port of the "out of zone" tests of phase 3 (RouteCreationOutOfZoneT3Testeur,
// RouteCreation.test, RouteCreationT4Testeur). Here the real engine logic
// (`createRoutingEngine`) runs behind the screen, with a counted fake native
// module: "zero engine call" means zero call of the native `route`.
// Table: docs/phases/preuves/p04/t4-tests-portes.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import iosSuccess from '@/core/routing/fixtures/ios-success.json';
import { createRoutingEngine } from '@/core/routing/routingEngine';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftScreen } from './DraftScreen';

let mockMapProps: Record<string, unknown> = {};
const mockAnnotations: Record<string, any> = {};
let mockNativeRoute: jest.Mock;
let mockEngine: ReturnType<typeof createRoutingEngine>;

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
    GeoJSONSource: (props: { children: ReactNode }) => <>{props.children}</>,
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
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePreventRemove: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [nancy] }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: (points: never, signal?: AbortSignal) =>
    mockEngine.route(points, signal),
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
const OUTSIDE: [number, number] = [2.35, 48.85];
const FAR_EAST: [number, number] = [7.5, 48.6];

async function renderDraft() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftScreen />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

async function touchMap(at: [number, number]) {
  await act(async () => {
    (mockMapProps.onPress as (e: unknown) => void)({
      nativeEvent: { lngLat: at, point: { x: 0, y: 0 } },
    });
    await new Promise((resolve) => setTimeout(resolve, 130));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  for (const key of Object.keys(mockAnnotations)) delete mockAnnotations[key];
  mockNativeRoute = jest.fn(async () => JSON.stringify(iosSuccess));
  mockEngine = createRoutingEngine(
    {
      open: async () => {},
      close: async () => {},
      route: mockNativeRoute,
    },
    () => ({ tarPath: '/t.tar', elevationDir: '/e' }),
  );
  mockEngine.setZone(nancy.zone);
});

describe('port: out of zone is refused before any native call (ADR 0016, section 5)', () => {
  it('sanity: two points in the zone do reach the native engine', async () => {
    await renderDraft();
    await touchMap(HAYE);
    await touchMap(NANCY);
    expect(mockNativeRoute).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('route-error')).toBeNull();
  });

  it('end outside the rectangle: sheet "Point hors de votre zone", zero native call', async () => {
    await renderDraft();
    await touchMap(HAYE);
    await touchMap(OUTSIDE);
    expect(mockNativeRoute).not.toHaveBeenCalled();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(screen.queryByText('Aucun chemin trouvé')).toBeNull();
  });

  it('end far to the east of the rectangle after a valid start: same sheet, zero native call', async () => {
    await renderDraft();
    await touchMap(HAYE);
    await touchMap(FAR_EAST);
    expect(mockNativeRoute).not.toHaveBeenCalled();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
  });

  it('start outside the rectangle: same sheet, zero native call', async () => {
    await renderDraft();
    await touchMap(OUTSIDE);
    expect(mockNativeRoute).not.toHaveBeenCalled();
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
  });

  it('the refused point is the outside one: "Retirer ce point" keeps the start', async () => {
    await renderDraft();
    await touchMap(HAYE);
    await touchMap(OUTSIDE);
    expect(screen.getByTestId('route-rejected')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.queryByTestId('route-rejected')).toBeNull();
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(screen.queryAllByTestId(/^annotation:/)).toHaveLength(1);
    expect(screen.getByText("Touchez l'arrivée sur la carte")).toBeTruthy();
    expect(mockNativeRoute).not.toHaveBeenCalled();
  });
});
