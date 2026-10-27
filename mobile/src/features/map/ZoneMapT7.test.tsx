import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// MapLibre, the GPS and the disk are replaced: no native module in Jest.
const mockEaseTo = jest.fn();
const mockNavigate = jest.fn();
let mockMapProps: Record<string, unknown> = {};
let mockPosition:
  { coords: { longitude: number; latitude: number } } | undefined;
let mockInstalled: ReadyMarker[] | undefined;
let mockPermission: { granted: boolean; canAskAgain: boolean } = {
  granted: true,
  canAskAgain: true,
};
const mockRequest = jest.fn();
const mockGet = jest.fn();

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
  getForegroundPermissionsAsync: () => {
    mockGet();
    return Promise.resolve(mockPermission);
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
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

async function renderScreen() {
  const queryClient = new QueryClient();
  await render(
    <QueryClientProvider client={queryClient}>
      <MapScreen />
    </QueryClientProvider>,
  );
  // Lets the permission request finish.
  await act(async () => {});
}

const message = 'Vous êtes hors de la zone téléchargée';
const nancyCentre = { coords: { longitude: 6.1844, latitude: 48.6921 } };
const metz = { coords: { longitude: 6.1757, latitude: 49.1193 } };
const recenter = () =>
  screen.getByRole('button', { name: 'Recentrer sur ma position' });

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockPosition = undefined;
  mockPermission = { granted: true, canAskAgain: true };
});

describe('B5: opening of the map', () => {
  it('centers on the first position inside the zone, zoom 14', async () => {
    mockPosition = nancyCentre;
    await renderScreen();
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1844, 48.6921], zoom: 14 }),
    );
    expect(mockEaseTo.mock.calls[0][0].duration).toBeLessThanOrEqual(300);
  });

  it('keeps the whole zone without a position', async () => {
    await renderScreen();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('keeps the whole zone when the position is outside', async () => {
    mockPosition = metz;
    await renderScreen();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('does not move the map once the user has touched it', async () => {
    const element = (
      <QueryClientProvider client={new QueryClient()}>
        <MapScreen />
      </QueryClientProvider>
    );
    const view = await render(element);
    await act(async () => {});
    const onRegionDidChange = mockMapProps.onRegionDidChange as (
      e: unknown,
    ) => void;
    await act(async () => {
      onRegionDidChange({ nativeEvent: { zoom: 10, userInteraction: true } });
    });
    mockPosition = nancyCentre;
    await view.rerender(element);
    expect(mockEaseTo).not.toHaveBeenCalled();
  });
});

describe('message outside the zone', () => {
  it('stays while the position is outside, with no delay', async () => {
    jest.useFakeTimers();
    try {
      mockPosition = metz;
      await renderScreen();
      expect(screen.getByText(message)).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });
      expect(screen.getByText(message)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('goes away when the position is back in the zone', async () => {
    mockPosition = metz;
    await renderScreen();
    expect(screen.getByText(message)).toBeTruthy();
    mockPosition = nancyCentre;
    await renderScreen();
    expect(screen.queryByText(message)).toBeNull();
  });
});

describe('B7: refused permission', () => {
  beforeEach(() => {
    mockPermission = { granted: false, canAskAgain: false };
  });

  it('opens a native alert that leads to the settings', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue();
    await renderScreen();
    await fireEvent.press(recenter());
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, text, buttons] = alert.mock.calls[0];
    expect(title).toBe('Position désactivée');
    expect(text).toBe(
      'Autorisez la position dans les réglages pour voir où vous êtes sur la carte.',
    );
    expect(buttons?.map((b) => b.text)).toEqual([
      'Annuler',
      'Ouvrir les réglages',
    ]);
    buttons?.[1].onPress?.();
    expect(openSettings).toHaveBeenCalled();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('asks the permission again when the system allows it', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPermission = { granted: false, canAskAgain: true };
    await renderScreen();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    await fireEvent.press(recenter());
    await act(async () => {});
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(alert).not.toHaveBeenCalled();
  });

  it('reads the permission again when back in the app', async () => {
    let listener: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      fn: (state: string) => void,
    ) => {
      listener = fn;
      return { remove: () => {} };
    }) as never);
    await renderScreen();
    expect(screen.queryByText('blue dot')).toBeNull();
    mockPermission = { granted: true, canAskAgain: true };
    await act(async () => listener('active'));
    expect(mockGet).toHaveBeenCalled();
    expect(screen.getByText('blue dot')).toBeTruthy();
  });
});
