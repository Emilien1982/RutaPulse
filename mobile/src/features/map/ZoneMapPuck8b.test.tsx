import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, StyleSheet } from 'react-native';

import { nearCenter, nearZoom } from '@/core/zones/opening';
import { nancyTrails } from '@/core/trails/testing';
import type { Zone } from '@/core/zones/catalogue';

import { ZoneMap } from './ZoneMap';

// The map tab of the phase 8b (ADR 0021, section 9): the dot, the three states
// of the button, the opening and the framing out of the zone. MapLibre, the
// GPS, the circuits and the router are replaced.
const mockEaseTo = jest.fn();
let mockCameraProps: Record<string, any> = {};
let mockMapProps: Record<string, any> = {};
const mockSources: Record<string, any> = {};
const mockLayers: Record<string, any> = {};
let mockPosition: Record<string, any> | undefined;
let mockPermission: { granted: boolean; canAskAgain: boolean };
let mockRequest: () => Promise<unknown>;
let mockTrailPress: ((e: unknown) => void) | undefined;
let mockOnClose: (() => void) | undefined;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, any> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: (props: Record<string, any>) => {
      mockCameraProps = props;
      if (props.ref) props.ref.current = { easeTo: mockEaseTo };
      return null;
    },
    Images: () => null,
    Layer: (props: { id: string }) => {
      mockLayers[props.id] = props;
      return null;
    },
    GeoJSONSource: (props: { id: string; children: ReactNode }) => {
      mockSources[props.id] = props;
      return <>{props.children}</>;
    },
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    useCurrentPosition: (options?: { enabled?: boolean }) =>
      options?.enabled ? mockPosition : undefined,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequest(),
  getForegroundPermissionsAsync: () => Promise.resolve(mockPermission),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }),
}));
jest.mock('./useTrails', () => ({ useTrails: () => mockTrails }));
jest.mock('./TrailsLayer', () => ({
  TrailsLayer: (props: { onPress: (e: unknown) => void }) => {
    mockTrailPress = props.onPress;
    return null;
  },
}));
jest.mock('./TrailSheet', () => ({
  TrailPanel: (props: { one?: { onClose: () => void } }) => {
    const { Text } = jest.requireActual('react-native');
    mockOnClose = props.one?.onClose;
    return <Text>sheet</Text>;
  },
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const mockTrails = nancyTrails();
const nancy: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 3,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 1,
  files: [],
};
const MAP = { width: 390, height: 752 };

const fix = (
  lon: number,
  lat: number,
  extra: Record<string, unknown> = {},
) => ({
  coords: {
    longitude: lon,
    latitude: lat,
    accuracy: 5,
    heading: null,
    speed: null,
    ...extra,
  },
  timestamp: 1_700_000_000_000,
});
const inside = fix(6.1844, 48.6921);
// 2.5 km east of the zone (mockup 90), and 20 km north (far).
const east = fix(
  6.52 + 2500 / (111_195 * Math.cos((48.7 * Math.PI) / 180)),
  48.7,
);
const far = fix(6.1757, 49.1193);

const tree = () => <ZoneMap zone={nancy} />;
async function open(element = tree()) {
  const view = await render(element);
  await act(async () => {});
  await fireEvent(screen.getByLabelText('Carte de la zone Nancy'), 'layout', {
    nativeEvent: { layout: MAP },
  });
  return view;
}
async function newPosition(
  view: { rerender: (e: React.ReactElement) => unknown },
  p: typeof inside,
) {
  mockPosition = p;
  await view.rerender(tree());
  await act(async () => {});
}
async function wait(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
const button = (name: string) => screen.getByRole('button', { name });
const REST = 'Recentrer sur ma position';
const FOLLOW = 'La carte suit ma position';
const REFUSED = 'Position désactivée';
const message = 'Vous êtes hors de la zone téléchargée';

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  for (const k of Object.keys(mockSources)) delete mockSources[k];
  mockPosition = undefined;
  mockPermission = { granted: true, canAskAgain: true };
  mockRequest = () => Promise.resolve(mockPermission);
  mockCameraProps = {};
});
afterEach(() => jest.useRealTimers());

describe('the dot of the user', () => {
  it('draws our own layers, from bottom to top, the arrow with the heading', async () => {
    await open();
    expect(
      Object.keys(mockLayers).filter((id) => id.startsWith('position')),
    ).toEqual([
      'position-halo',
      'position-ombre',
      'position-rond',
      'position-fleche',
    ]);
    expect(mockLayers['position-rond'].paint['circle-radius']).toBe(13);
    expect(mockLayers['position-rond'].paint['circle-color']).toBe('#1A73E8');
    expect(mockLayers['position-rond'].paint['circle-stroke-width']).toBe(3);
    expect(mockLayers['position-fleche'].filter).toEqual(['has', 'heading']);
    expect(mockLayers['position-fleche'].layout['icon-size']).toBe(0.8);
    expect(mockLayers['position-halo'].filter).toEqual(['has', 'r0']);
  });

  it('puts the heading and the halo radius on the point', async () => {
    mockPosition = fix(6.18, 48.69, { heading: 187, speed: 3, accuracy: 5 });
    await open();
    const data = mockSources.position.data;
    expect(data.properties.heading).toBe(187);
    expect(data.properties.r0 * 2 ** 17).toBeCloseTo(12.7, 1);
    expect(data.geometry.coordinates).toEqual([6.18, 48.69]);
  });

  it('shows no arrow without a heading (iOS gives -1)', async () => {
    mockPosition = fix(6.18, 48.69, { heading: -1, speed: 0 });
    await open();
    expect('heading' in mockSources.position.data.properties).toBe(false);
  });

  it('keeps the last heading under 0.5 m/s, then hides it after 5 s', async () => {
    mockPosition = fix(6.18, 48.69, { heading: 120, speed: 3 });
    const view = await open();
    const slow = (at: number) =>
      newPosition(view, {
        ...fix(6.18, 48.69, { heading: 300, speed: 0.2 }),
        timestamp: 1_700_000_000_000 + at,
      });
    await slow(1000);
    await slow(5000);
    expect(mockSources.position.data.properties.heading).toBe(120);
    await slow(7000);
    expect('heading' in mockSources.position.data.properties).toBe(false);
  });

  it('is drawn without a point while there is no position', async () => {
    await open();
    expect(mockSources.position.data.type).toBe('FeatureCollection');
  });
});

describe('the three states of the button', () => {
  it('is at rest with the permission and no follow', async () => {
    await open();
    expect(button(REST)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
  });

  it('is crossed out, with a hint, when the permission is refused', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await open();
    expect(button(REFUSED).props.accessibilityHint).toBe(
      "Touchez pour l'autoriser dans les réglages",
    );
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
  });

  it('is not crossed out before the first answer of the phone', async () => {
    let answer: (value: unknown) => void = () => {};
    mockRequest = () => new Promise((resolve) => (answer = resolve));
    await render(tree());
    expect(button(REST)).toBeTruthy();
    await act(async () => answer({ granted: false, canAskAgain: true }));
    expect(button(REFUSED)).toBeTruthy();
  });

  it('follows after the opening in the zone, then goes back to rest on a gesture', async () => {
    mockPosition = inside;
    await open();
    await wait(400);
    expect(button(FOLLOW)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBe('default');
    await act(async () =>
      mockCameraProps.onTrackUserLocationChange({
        nativeEvent: { trackUserLocation: null },
      }),
    );
    expect(button(REST)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    // Android sends the event twice.
    await act(async () =>
      mockCameraProps.onTrackUserLocationChange({
        nativeEvent: { trackUserLocation: null },
      }),
    );
    expect(button(REST)).toBeTruthy();
  });

  it('keeps following when MapLibre says it follows', async () => {
    mockPosition = inside;
    await open();
    await wait(400);
    await act(async () =>
      mockCameraProps.onTrackUserLocationChange({
        nativeEvent: { trackUserLocation: 'default' },
      }),
    );
    expect(button(FOLLOW)).toBeTruthy();
  });

  it('follows again after a touch at rest, at once when the zoom is 15 or more', async () => {
    mockPosition = inside;
    await open();
    await wait(400);
    await act(async () =>
      mockCameraProps.onTrackUserLocationChange({
        nativeEvent: { trackUserLocation: null },
      }),
    );
    // The map is at zoom 16.
    await act(async () => mockEasePropsRegion(16));
    mockEaseTo.mockClear();
    await fireEvent.press(button(REST));
    expect(mockEaseTo).not.toHaveBeenCalled();
    expect(button(FOLLOW)).toBeTruthy();
  });

  it('moves to the position at zoom 15 first when the map is farther', async () => {
    mockPosition = inside;
    await open();
    await wait(400);
    await act(async () =>
      mockCameraProps.onTrackUserLocationChange({
        nativeEvent: { trackUserLocation: null },
      }),
    );
    await act(async () => mockEasePropsRegion(12));
    mockEaseTo.mockClear();
    await fireEvent.press(button(REST));
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [6.1844, 48.6921],
        zoom: 15,
        duration: 500,
      }),
    );
    // Follows at the end of the move, not before.
    expect(button(REST)).toBeTruthy();
    await wait(600);
    expect(button(FOLLOW)).toBeTruthy();
  });

  it('follows at once when touched before the first position, then goes to it', async () => {
    const view = await open();
    await fireEvent.press(button(REST));
    expect(button(FOLLOW)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBe('default');
    expect(mockEaseTo).not.toHaveBeenCalled();
    await newPosition(view, inside);
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1844, 48.6921], zoom: 15 }),
    );
    await wait(600);
    expect(button(FOLLOW)).toBeTruthy();
  });

  it('touched before the first position, out of the zone: back to rest and the framing of the case', async () => {
    const view = await open();
    await fireEvent.press(button(REST));
    await newPosition(view, east);
    expect(button(REST)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    expect(mockEaseTo.mock.calls[0][0].zoom).toBeLessThan(14);
  });

  it('stops following when the position leaves the zone', async () => {
    mockPosition = inside;
    const view = await open();
    await wait(400);
    expect(button(FOLLOW)).toBeTruthy();
    await newPosition(view, far);
    expect(button(REST)).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('asks for the permission on touch when refused, and follows when allowed', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await open();
    mockPermission = { granted: true, canAskAgain: true };
    await fireEvent.press(button(REFUSED));
    await act(async () => {});
    expect(button(FOLLOW)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBe('default');
  });
});

describe('opening', () => {
  it('in the zone: centered, zoom 14, then follows', async () => {
    mockPosition = inside;
    await open();
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1844, 48.6921], zoom: 14 }),
    );
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    await wait(400);
    expect(mockCameraProps.trackUserLocation).toBe('default');
    expect(screen.queryByText(message)).toBeNull();
  });

  it('within 10 km: centered on the closest edge, at the zoom of nearZoom, at rest, with the message', async () => {
    await open().then(async (view) => newPosition(view, east));
    const edge: [number, number] = [6.52, 48.7];
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    const call = mockEaseTo.mock.calls[0][0];
    expect(call.center).toEqual(nearCenter(nancy.bbox, edge));
    expect(call.zoom).toBeCloseTo(
      nearZoom(edge, [east.coords.longitude, 48.7], MAP, {
        side: 48,
        top: 140,
        bottom: 32,
      }),
      10,
    );
    expect(call.zoom).toBeCloseTo(11.6, 1);
    expect(call.padding).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    await wait(1000);
    expect(button(REST)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('farther than 10 km: the whole zone stays, at rest, with the message', async () => {
    mockPosition = far;
    await open();
    expect(mockEaseTo).not.toHaveBeenCalled();
    expect(button(REST)).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('without a position: the whole zone, no message', async () => {
    await open();
    expect(mockEaseTo).not.toHaveBeenCalled();
    expect(screen.queryByText(message)).toBeNull();
  });

  it('with the permission refused: the whole zone, crossed-out button', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    mockPosition = inside;
    await open();
    expect(mockEaseTo).not.toHaveBeenCalled();
    expect(button(REFUSED)).toBeTruthy();
  });

  it('does not frame again at the next positions', async () => {
    const view = await open();
    await newPosition(view, east);
    mockEaseTo.mockClear();
    await newPosition(view, fix(east.coords.longitude + 0.001, 48.7));
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('touch at rest within 10 km: the same framing as the opening (question b)', async () => {
    const view = await open();
    await newPosition(view, east);
    const opening = mockEaseTo.mock.calls[0][0];
    mockEaseTo.mockClear();
    await fireEvent.press(button(REST));
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    expect(mockEaseTo.mock.calls[0][0]).toEqual(opening);
  });

  it('touch at rest farther than 10 km: the closest point of the zone, zoom 15 at least', async () => {
    mockPosition = far;
    await open();
    await fireEvent.press(button(REST));
    expect(mockEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [6.1757, 48.92], zoom: 15 }),
    );
  });
});

describe('corrections of the review', () => {
  const gesture = (name: 'onRegionWillChange' | 'onRegionDidChange') =>
    act(async () =>
      mockMapProps[name]({
        nativeEvent: { zoom: 12, center: [6.1, 48.6], userInteraction: true },
      }),
    );

  it('a gesture after a touch before the first position cancels the jump', async () => {
    const view = await open();
    await fireEvent.press(button(REST));
    await gesture('onRegionWillChange');
    await gesture('onRegionDidChange');
    await newPosition(view, inside);
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('a circuit touched after a touch before the first position cancels the jump', async () => {
    const view = await open();
    await fireEvent.press(button(REST));
    await act(async () =>
      mockTrailPress?.({
        stopPropagation: jest.fn(),
        nativeEvent: {
          lngLat: [6.0, 48.7],
          features: [{ properties: { osm_id: mockTrails[0].osmId } }],
        },
      }),
    );
    mockEaseTo.mockClear();
    await newPosition(view, inside);
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('a gesture at the start cancels the "follow again" of the move', async () => {
    mockPosition = inside;
    await open();
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    await gesture('onRegionWillChange');
    await wait(1000);
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    expect(button(REST)).toBeTruthy();
  });

  it('the message out of the zone is 48 high at least, text centered', async () => {
    mockPosition = far;
    await open();
    const style = StyleSheet.flatten(
      screen.getByText(message).parent!.props.style,
    );
    expect(style.minHeight).toBe(48);
    expect(style.justifyContent).toBe('center');
  });

  it('listens to the return to the app only once the first request is answered', async () => {
    const add = jest.spyOn(AppState, 'addEventListener');
    let answer: (value: unknown) => void = () => {};
    mockRequest = () => new Promise((resolve) => (answer = resolve));
    await render(tree());
    expect(add).not.toHaveBeenCalled();
    await act(async () => answer({ granted: false, canAskAgain: true }));
    expect(add).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('a permission given by the first request does not follow before the first position', async () => {
    let answer: (value: unknown) => void = () => {};
    mockRequest = () => new Promise((resolve) => (answer = resolve));
    const view = await render(tree());
    await act(async () => answer({ granted: true, canAskAgain: true }));
    expect(button(REST)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    await newPosition(view, far);
    expect(mockEaseTo).not.toHaveBeenCalled();
    expect(button(REST)).toBeTruthy();
  });

  it('back from the settings after a refusal follows at once', async () => {
    let listener: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      fn: (state: string) => void,
    ) => {
      listener = fn;
      return { remove: () => {} };
    }) as never);
    mockPermission = { granted: false, canAskAgain: false };
    await open();
    mockPermission = { granted: true, canAskAgain: true };
    await act(async () => listener('active'));
    expect(button(FOLLOW)).toBeTruthy();
  });
});

describe('a circuit touched while following', () => {
  async function touch() {
    await act(async () =>
      mockTrailPress?.({
        stopPropagation: jest.fn(),
        nativeEvent: {
          lngLat: [6.0, 48.7],
          features: [{ properties: { osm_id: mockTrails[0].osmId } }],
        },
      }),
    );
  }

  it('stops following when the camera frames the circuit, and follows again when the sheet is closed', async () => {
    mockPosition = inside;
    await open();
    await wait(400);
    expect(mockCameraProps.trackUserLocation).toBe('default');
    await touch();
    expect(screen.getByText('sheet')).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    expect(button(REST)).toBeTruthy();
    await act(async () => mockOnClose?.());
    await wait(400);
    expect(mockCameraProps.trackUserLocation).toBe('default');
    expect(button(FOLLOW)).toBeTruthy();
  });

  it('stays at rest after the sheet when it was not following', async () => {
    await open();
    await touch();
    await act(async () => mockOnClose?.());
    await wait(400);
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    expect(button(REST)).toBeTruthy();
  });
});

// The map says where it is after each move.
function mockEasePropsRegion(zoom: number) {
  mockMapProps.onRegionDidChange({
    nativeEvent: { zoom, center: [6.18, 48.69], userInteraction: false },
  });
}
