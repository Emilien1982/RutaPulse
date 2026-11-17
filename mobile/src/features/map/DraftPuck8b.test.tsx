import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { DraftInSession } from './testing/DraftInSession';

// The creation screen has the same dot as the map tab (arrow, halo), but its
// button has two states only: no "suit ma position" while points are put
// (ADR 0021, section 9.1). MapLibre, the router, the disk and the engine are
// replaced.
const mockSources: Record<string, any> = {};
const mockAnnotations: Record<string, any> = {};
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();
const mockEaseTo = jest.fn();
let mockGranted = false;
let mockPosition:
  { coords: { longitude: number; latitude: number } } | undefined;
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: { children: ReactNode }) => {
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: { ref?: React.Ref<unknown> }) => {
      useImperativeHandle(props.ref, () => ({ easeTo: mockEaseTo }));
      return null;
    },
    useCurrentPosition: () => mockPosition,
    Images: () => null,
    Layer: () => null,
    GeoJSONSource: (props: { id: string; data: unknown }) => {
      mockSources[props.id] = props.data;
      return null;
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
    Promise.resolve({ granted: mockGranted, canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ granted: mockGranted, canAskAgain: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
  usePreventRemove: jest.fn(),
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

// A leg whose shape ends exactly on the points: no dotted link.
function success(distanceKm = 2, durationS = 600): RouteResult {
  return {
    ok: true,
    shape: [
      [6.1, 48.66],
      [6.14, 48.68],
    ],
    distanceKm,
    durationS,
  };
}

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftInSession />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockParams = {};
  mockGranted = true;
  mockPosition = undefined;
  for (const key of Object.keys(mockSources)) delete mockSources[key];
  for (const key of Object.keys(mockAnnotations)) delete mockAnnotations[key];
  mockComputeRoute.mockResolvedValue(success());
});

describe('the dot on the creation screen', () => {
  it('draws the arrow and the halo from the position', async () => {
    mockPosition = {
      coords: {
        longitude: 6.13,
        latitude: 48.66,
        accuracy: 10,
        heading: 45,
        speed: 2,
      },
    } as never;
    await renderScreen();
    const data = mockSources.position as {
      properties: { heading: number; r0: number };
    };
    expect(data.properties.heading).toBe(45);
    expect(data.properties.r0).toBeGreaterThan(0);
  });

  it('keeps a button with two states: it never says that the map follows', async () => {
    mockPosition = { coords: { longitude: 6.13, latitude: 48.66 } };
    await renderScreen();
    const button = screen.getByRole('button', {
      name: 'Recentrer sur ma position',
    });
    await fireEvent.press(button);
    await act(async () => {});
    expect(
      screen.getByRole('button', { name: 'Recentrer sur ma position' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('La carte suit ma position')).toBeNull();
  });

  it('crosses the button out when the permission is refused', async () => {
    mockGranted = false;
    await renderScreen();
    expect(
      screen.getByRole('button', { name: 'Position désactivée' }),
    ).toBeTruthy();
  });
});
