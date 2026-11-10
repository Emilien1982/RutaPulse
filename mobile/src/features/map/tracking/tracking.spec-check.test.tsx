// Independent check of T3 (phase 8a), written from the spec: C4, C5, C7, C8.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';

import { buildLine } from '@/core/tracking/trackingLine';
import { lineOf, straight, toLonLat } from '@/core/tracking/testing/fabricate';

import { TrackingSession } from './TrackingSession';

const mockBack = jest.fn();
const mockRemove = jest.fn();
const mockWatch = jest.fn();
const mockKeepOn = jest.fn();
const mockKeepOff = jest.fn();
let mockPrevent: { enabled: boolean; callback: () => void } | null = null;
let mockOnFix: ((location: unknown) => void) | null = null;
let now = 1_700_000_000_000;
let appListener: ((state: AppStateStatus) => void) | null = null;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: { children: ReactNode }) => <View>{props.children}</View>,
    Camera: () => null,
    Layer: () => null,
    GeoJSONSource: () => null,
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  usePreventRemove: (enabled: boolean, callback: () => void) => {
    mockPrevent = { enabled, callback };
  },
}));
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  watchPositionAsync: (...args: unknown[]) => mockWatch(...args),
}));
jest.mock('expo-keep-awake', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useKeepAwake: () =>
      useEffect(() => {
        mockKeepOn();
        return () => mockKeepOff();
      }, []),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routing/computeGuidance', () => ({
  computeTraceRoute: () => Promise.resolve({ ok: false, error: 'failed' }),
  computeMatchedEdges: () => Promise.resolve({ ok: false, error: 'failed' }),
}));

const source = () => ({
  line: buildLine(lineOf(straight(2000))),
  free: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrevent = null;
  mockOnFix = null;
  appListener = null;
  now = 1_700_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockWatch.mockImplementation((_o, onFix) => {
    mockOnFix = onFix;
    return Promise.resolve({ remove: mockRemove });
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _t: string,
    l: (s: AppStateStatus) => void,
  ) => {
    appListener = l;
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function open() {
  await render(<TrackingSession source={source()} climb={null} zone={null} />);
  await act(async () => {});
}
async function fix(x: number, y = 0) {
  now += 1000;
  const [lon, lat] = toLonLat([x, y]);
  await act(async () => {
    mockOnFix?.({ coords: { longitude: lon, latitude: lat, accuracy: 5 } });
  });
}
const buttons = () =>
  (Alert.alert as jest.Mock).mock.calls[0]?.[2] as {
    text: string;
    onPress?: () => void;
  }[];
const bg = () =>
  screen
    .getByTestId('tracking-panel')
    .props.style.flat()
    .find((s: { backgroundColor?: string }) => s?.backgroundColor)
    .backgroundColor;
const background = (state: AppStateStatus) =>
  act(async () => {
    appListener?.(state);
  });

describe('C7 Terminer', () => {
  it('asks confirmation; Continuer changes nothing', async () => {
    await open();
    await fix(300);
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const cont = buttons().find((b) => b.text === 'Continuer');
    expect(cont).toBeDefined();
    await act(async () => cont?.onPress?.());
    expect(screen.getByTestId('tracking-panel')).toBeOnTheScreen();
    expect(screen.queryByTestId('ride-end')).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockKeepOff).not.toHaveBeenCalled();
  });

  it('Terminer after 300 m: summary titled "Sortie terminée", GPS off, screen released', async () => {
    await open();
    for (let x = 0; x <= 300; x += 15) await fix(x);
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    await act(async () =>
      buttons()
        .find((b) => b.text === 'Terminer')
        ?.onPress?.(),
    );
    expect(screen.getByTestId('ride-end')).toBeOnTheScreen();
    expect(screen.getByText(/sortie terminée/i)).toBeOnTheScreen();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockKeepOff).toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Terminer under 100 m ridden: back, no summary', async () => {
    await open();
    for (let x = 0; x <= 60; x += 15) await fix(x);
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    await act(async () =>
      buttons()
        .find((b) => b.text === 'Terminer')
        ?.onPress?.(),
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ride-end')).toBeNull();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockKeepOff).toHaveBeenCalled();
  });

  it('system back (Android) is intercepted and opens the same box', async () => {
    await open();
    expect(mockPrevent?.enabled).toBe(true);
    await act(async () => mockPrevent?.callback());
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(buttons().map((b) => b.text)).toEqual(['Continuer', 'Terminer']);
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe(
      'Terminer la sortie ?',
    );
  });
});

describe('C8 screen awake and background', () => {
  it('awake while tracking, GPS on', async () => {
    await open();
    expect(mockKeepOn).toHaveBeenCalledTimes(1);
    expect(mockKeepOff).not.toHaveBeenCalled();
    expect(mockWatch).toHaveBeenCalledTimes(1);
  });

  it('background cuts the GPS; return restarts it and keeps the progress', async () => {
    await open();
    await fix(900);
    const before = screen.getByTestId('tracking-remaining').props.children;
    await background('background');
    expect(mockRemove).toHaveBeenCalledTimes(1);
    now += 20_000;
    await background('active');
    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('tracking-remaining').props.children).toBe(
      before,
    );
    await fix(930);
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent(
      '1,1 km',
    );
  });
});

describe('C4 panel and footer', () => {
  it('white far from the arrival, yellow under 100 m', async () => {
    await open();
    await fix(500);
    expect(bg()).toBe('#FFFFFF');
    await fix(1950);
    expect(bg()).toBe('#FFD400');
    expect(screen.getByTestId('tracking-distance')).toHaveTextContent(
      /^50\s*m/,
    );
  });

  it('shows Reste and D+ restant, no gear wheel', async () => {
    await open();
    await fix(500);
    expect(screen.getByText('Reste')).toBeOnTheScreen();
    expect(screen.getByText('D+ restant')).toBeOnTheScreen();
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent(
      '1,5 km',
    );
    expect(screen.queryByTestId('tracking-settings')).toBeNull();
  });
});

describe('C5 off track', () => {
  it('shows the distance to the route beyond 30 m, no alert, no sound; back on track resumes', async () => {
    await open();
    await fix(500);
    for (const y of [10, 20, 30, 40, 50, 60, 70, 80]) await fix(500 + y, y);
    expect(screen.getByTestId('tracking-distance')).toHaveTextContent(
      /^80\s*m/,
    );
    expect(screen.getByText("jusqu'au tracé")).toBeOnTheScreen();
    expect(Alert.alert).not.toHaveBeenCalled();
    for (const y of [60, 40, 20, 0]) await fix(600 + (60 - y), y);
    expect(screen.queryByText("jusqu'au tracé")).toBeNull();
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent(
      '1,3 km',
    );
  });

  it('does not show a gap at 20 m', async () => {
    await open();
    await fix(500);
    for (const y of [5, 10, 15, 20]) await fix(500 + y, y);
    expect(screen.queryByText("jusqu'au tracé")).toBeNull();
  });
});
