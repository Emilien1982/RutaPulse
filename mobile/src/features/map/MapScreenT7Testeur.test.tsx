import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, Linking } from 'react-native';

import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// Tests written from the spec (design/comparaisons/p02-t7.md, B5, B7, and the
// steering decision on the message outside the zone).
const mockEaseTo = jest.fn();
let mockMapProps: Record<string, unknown> = {};
let mockPosition:
  { coords: { longitude: number; latitude: number } } | undefined;
let mockPermission = { granted: true, canAskAgain: true };
const mockRequest = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View, Text } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: Record<string, unknown> & { ref?: unknown }) => {
      const ref = props.ref as { current: unknown } | undefined;
      if (ref) ref.current = { easeTo: mockEaseTo };
      return null;
    },
    Layer: () => null,
    UserLocation: () => <Text>blue dot</Text>,
    useCurrentPosition: () => mockPosition,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => {
    mockRequest();
    return Promise.resolve(mockPermission);
  },
  getForegroundPermissionsAsync: () => Promise.resolve(mockPermission),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [mockNancy] }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const mockNancy: ReadyMarker = {
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
const OUTSIDE = 'Vous êtes hors de la zone téléchargée';
const inNancy = { coords: { longitude: 6.1844, latitude: 48.6921 } };
const inMetz = { coords: { longitude: 6.1757, latitude: 49.1193 } };
const client = new QueryClient();
// A new element each time, so that React renders again.
const tree = () => (
  <QueryClientProvider client={client}>
    <MapScreen />
  </QueryClientProvider>
);
const locateButton = () =>
  screen.getByRole('button', { name: 'Recentrer sur ma position' });

async function open() {
  const view = await render(tree());
  await act(async () => {});
  return view;
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockPosition = undefined;
  mockPermission = { granted: true, canAskAgain: true };
});

describe('B5 opening', () => {
  it('goes to the position at zoom 14 when inside the zone', async () => {
    mockPosition = inNancy;
    await open();
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1844, 48.6921], zoom: 14 }),
    );
  });

  it('leaves the whole zone when the position is outside', async () => {
    mockPosition = inMetz;
    await open();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('leaves the whole zone without position', async () => {
    await open();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('does not take the map back after a touch of the user', async () => {
    const view = await open();
    const onChange = mockMapProps.onRegionDidChange as (e: unknown) => void;
    await act(async () => {
      onChange({ nativeEvent: { zoom: 11, userInteraction: true } });
    });
    mockPosition = inNancy;
    await view.rerender(tree());
    await act(async () => {});
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('does not re-center again on the next positions', async () => {
    mockPosition = inNancy;
    const view = await open();
    mockPosition = { coords: { longitude: 6.19, latitude: 48.7 } };
    await view.rerender(tree());
    await act(async () => {});
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
  });
});

describe('message outside the zone', () => {
  it('is shown as soon as the position is outside, and stays 60 s', async () => {
    jest.useFakeTimers();
    try {
      mockPosition = inMetz;
      await open();
      expect(screen.getByText(OUTSIDE)).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByText(OUTSIDE)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('is absent inside the zone and disappears when back inside', async () => {
    mockPosition = inNancy;
    const view = await open();
    expect(screen.queryByText(OUTSIDE)).toBeNull();
    mockPosition = inMetz;
    await view.rerender(tree());
    expect(screen.getByText(OUTSIDE)).toBeTruthy();
    mockPosition = inNancy;
    await view.rerender(tree());
    expect(screen.queryByText(OUTSIDE)).toBeNull();
  });
});

describe('B7 refused permission', () => {
  const crossed = () => JSON.stringify(screen.toJSON()).includes('M4 4L20 20');

  it('shows the crossed-out locate icon only when refused', async () => {
    await open();
    expect(crossed()).toBe(false);
    await screen.unmount();
    mockPermission = { granted: false, canAskAgain: true };
    await open();
    expect(crossed()).toBe(true);
  });

  it('asks again on touch when the system still allows it', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPermission = { granted: false, canAskAgain: true };
    await open();
    const before = mockRequest.mock.calls.length;
    await fireEvent.press(locateButton());
    await act(async () => {});
    expect(mockRequest.mock.calls.length).toBe(before + 1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('shows an alert to the settings when it no longer allows it', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockPermission = { granted: false, canAskAgain: false };
    await open();
    const before = mockRequest.mock.calls.length;
    await fireEvent.press(locateButton());
    expect(mockRequest.mock.calls.length).toBe(before);
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2] ?? [];
    expect(buttons.some((b) => b.style === 'cancel')).toBe(true);
    const open_ = buttons.find((b) => b.style !== 'cancel');
    expect(settings).not.toHaveBeenCalled();
    open_?.onPress?.();
    expect(settings).toHaveBeenCalledTimes(1);
  });

  it('keeps the normal recentering when the permission is granted', async () => {
    mockPosition = inNancy;
    await open();
    mockEaseTo.mockClear();
    await fireEvent.press(locateButton());
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1844, 48.6921], zoom: 15 }),
    );
  });
});
