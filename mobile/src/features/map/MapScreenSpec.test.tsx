// Tests written from the spec p02 (C9, C10, C6) and the decisions of T5.
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

const mockNavigate = jest.fn();
let mockInstalled: ReadyMarker[] = [];
let mockCamera: Record<string, unknown> = {};

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (p: { children: ReactNode }) => <View testID="map">{p.children}</View>,
    Camera: (p: Record<string, unknown>) => {
      mockCamera = p;
      return null;
    },
    Layer: () => null,
    UserLocation: () => null,
    useCurrentPosition: () => undefined,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve({ granted: false }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (z: { id: string }, p: string) => `file:///d/${z.id}/${p}`,
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///g',
}));

const bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };
const nancy: ReadyMarker = {
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00.000Z',
  zone: {
    id: 'nancy',
    name: 'Nancy',
    version: 1,
    bbox,
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 1,
    files: [],
  },
};

beforeEach(() => jest.clearAllMocks());

describe('C10 - no zone', () => {
  beforeEach(() => {
    mockInstalled = [];
  });

  it('offers to download a zone and goes to the Zones tab', async () => {
    await render(<MapScreen />);
    expect(screen.getByText('Pas encore de carte')).toBeTruthy();
    expect(screen.queryByTestId('map')).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Choisir une zone' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
  });
});

describe('C9 and C6 - with a zone', () => {
  beforeEach(() => {
    mockInstalled = [nancy];
  });

  it('shows the four attributions', async () => {
    await render(<MapScreen />);
    for (const name of ['OpenStreetMap', 'OpenMapTiles', 'Mapterhorn', 'IGN']) {
      expect(screen.getByText(new RegExp(`©\\s*${name}`))).toBeTruthy();
    }
  });

  it('limits the camera to the zone and to zooms 8-18', async () => {
    await render(<MapScreen />);
    expect(mockCamera.maxBounds).toEqual([5.84, 48.47, 6.52, 48.92]);
    expect(mockCamera.minZoom).toBe(8);
    expect(mockCamera.maxZoom).toBe(18);
  });
});
