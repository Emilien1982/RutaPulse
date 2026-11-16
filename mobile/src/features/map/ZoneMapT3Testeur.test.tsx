import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { nancyTrails } from '@/core/trails/testing';
import type { Zone } from '@/core/zones/catalogue';

import { ZoneMap } from './ZoneMap';

// Tests du testeur, T3 (phase 8b), d apres la spec C10 et l ADR 0021 (9.4, 9.5).
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
  TrailsLayer: () => null,
}));
jest.mock('./TrailSheet', () => ({
  TrailPanel: () => null,
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
// 2,5 km a l est de la zone (maquette 90).
const east = fix(
  6.52 + 2500 / (111_195 * Math.cos((48.7 * Math.PI) / 180)),
  48.7,
);

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

describe('testeur T3 : toucher sans position, puis glissement (cas du relecteur)', () => {
  it('le bouton repasse au repos quand MapLibre sort du suivi, et la carte ne saute pas a la premiere position', async () => {
    const view = await open();
    await fireEvent.press(button(REST));
    expect(button(FOLLOW)).toBeTruthy();
    await act(async () => {
      mockMapProps.onRegionWillChange({
        nativeEvent: { zoom: 12, center: [6.1, 48.6], userInteraction: true },
      });
      mockCameraProps.onTrackUserLocationChange({
        nativeEvent: { trackUserLocation: null },
      });
      mockMapProps.onRegionDidChange({
        nativeEvent: { zoom: 12, center: [6.1, 48.6], userInteraction: true },
      });
    });
    expect(button(REST)).toBeTruthy();
    expect(mockCameraProps.trackUserLocation).toBeUndefined();
    await newPosition(view, inside);
    await wait(1000);
    expect(mockEaseTo).not.toHaveBeenCalled();
    expect(button(REST)).toBeTruthy();
  });
});

describe('testeur T3 : cadrage hors zone (C10, ADR 9.5)', () => {
  // Distance de reference : 1 degre de latitude = 111,195 km (rayon moyen de
  // la Terre 6371 km). Mercator : 1 degre de latitude = 512/360/cos(lat)
  // points au zoom 0 (monde de 512 points).
  const km = (n: number) => n / 111.195;

  it('9,5 km au sud : cadre sur le bord sud, zoom donne par la marge du bas', async () => {
    const view = await open();
    await newPosition(view, fix(6.2, 48.47 - km(9.5)));
    const call = mockEaseTo.mock.calls[0][0];
    expect(call.center[0]).toBeCloseTo(6.2, 5);
    expect(call.center[1]).toBeCloseTo(48.47, 4);
    // Pas de mesure du bas dans ce test : marge du bas = 32. Place sous le
    // centre = 752 / 2 - 32 = 344 points.
    const dy0 = (km(9.5) * 512) / 360 / Math.cos((48.47 * Math.PI) / 180);
    expect(call.zoom).toBeCloseTo(Math.log2(344 / dy0), 1);
    expect(screen.getByText(message)).toBeTruthy();
    expect(button(REST)).toBeTruthy();
  });

  it('pres d un coin (sud-est) : centre sur le coin, zoom 14 au plus', async () => {
    const view = await open();
    await newPosition(view, fix(6.52 + 0.02, 48.47 - 0.02));
    const call = mockEaseTo.mock.calls[0][0];
    expect(call.center[0]).toBeCloseTo(6.52, 4);
    expect(call.center[1]).toBeCloseTo(48.47, 4);
    expect(call.zoom).toBeLessThanOrEqual(14);
    expect(call.zoom).toBeGreaterThan(11);
  });

  it('plus de 10 km : pas de cadrage, message affiche', async () => {
    const view = await open();
    await newPosition(view, fix(6.2, 48.47 - km(10.5)));
    expect(mockEaseTo).not.toHaveBeenCalled();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('Recentrer a moins de 10 km refait exactement le cadrage d ouverture', async () => {
    const view = await open();
    await newPosition(view, east);
    const opening = mockEaseTo.mock.calls[0][0];
    mockEaseTo.mockClear();
    await fireEvent.press(button(REST));
    expect(mockEaseTo).toHaveBeenCalledTimes(1);
    expect(mockEaseTo.mock.calls[0][0]).toEqual(opening);
  });
});
