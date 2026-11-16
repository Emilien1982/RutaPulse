// The gear and the panel of settings of the tracking (ADR 0021, section 8.6;
// mockups 30 and 31b), and the brightness during the tracking (section 8.3).
// MapLibre, the router, the GPS and the engine are faked.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, AppState, Platform, type AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';

import { buildLine, type TrackingSource } from '@/core/tracking/trackingLine';
import { lineOf, straight, toLonLat } from '@/core/tracking/testing/fabricate';

import {
  restoreSystemBrightnessAsync,
  setBrightnessAsync,
} from 'expo-brightness';

import { TrackingSession } from './TrackingSession';

const mockBack = jest.fn();
const mockRemove = jest.fn();
const mockWatch = jest.fn();
const mockKeepOn = jest.fn();
const mockKeepOff = jest.fn();
let mockPrevent: { enabled: boolean; callback: () => void } | null = null;
let mockOnFix: ((location: unknown) => void) | null = null;
let now = 1_700_000_000_000;
// Positions kept so far, and the last x: the start rule wants the 2nd position at a plausible speed.
let fixCount = 0;
let lastX = 0;
let lastY = 0;

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
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routing/computeGuidance', () => ({
  computeTraceRoute: () => Promise.resolve({ ok: false, error: 'failed' }),
  computeMatchedEdges: () => Promise.resolve({ ok: false, error: 'failed' }),
}));

const LINE_M = 2000;
const source = (free: TrackingSource['free'] = []): TrackingSource => ({
  line: buildLine(lineOf(straight(LINE_M))),
  free,
});

let appListeners: ((state: AppStateStatus) => void)[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockPrevent = null;
  mockOnFix = null;
  appListeners = [];
  now = 1_700_000_000_000;
  fixCount = 0;
  lastX = 0;
  lastY = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockWatch.mockImplementation((_options, onFix) => {
    mockOnFix = onFix;
    return Promise.resolve({ remove: mockRemove });
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    listener: (state: AppStateStatus) => void,
  ) => {
    appListeners.push(listener);
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const mockChoose = jest.fn();

async function open(choice: 'auto' | 'max' = 'auto') {
  await render(
    <TrackingSession
      source={source()}
      climb={null}
      zone={null}
      brightness={{ choice, onChoose: mockChoose }}
    />,
  );
  await act(async () => {});
}

// A position at (x, y) meters from the start of the line, `gap` ms after the last.
async function fix(x: number, y = 0, gap = 1000) {
  now += Math.max(
    gap,
    fixCount === 1 ? Math.hypot(x - lastX, y - lastY) * 100 : 0,
  );
  fixCount += 1;
  lastX = x;
  lastY = y;
  const [lon, lat] = toLonLat([x, y]);
  await act(async () => {
    mockOnFix?.({ coords: { longitude: lon, latitude: lat, accuracy: 5 } });
  });
}

const gear = () => screen.getByRole('button', { name: 'Réglages du suivi' });

describe('gear and panel of settings', () => {
  it('shows the gear on the map, folded, and no panel', async () => {
    await open();
    expect(gear().props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByTestId('tracking-settings-panel')).toBeNull();
    expect(screen.getByTestId('tracking-footer')).toBeOnTheScreen();
  });

  it('opens the panel without blocking the guidance, and hides "Reste"', async () => {
    await open();
    await fix(100);
    await fireEvent.press(gear());
    expect(screen.getByTestId('tracking-settings-panel')).toBeOnTheScreen();
    expect(gear().props.accessibilityState.expanded).toBe(true);
    expect(screen.getByText("Luminosité de l'écran")).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { name: 'Automatique' }).props
        .accessibilityState.checked,
    ).toBe(true);
    expect(screen.queryByTestId('tracking-footer')).toBeNull();
    // The guidance goes on: a new position changes the panel at the top.
    expect(screen.getByTestId('tracking-distance')).toHaveTextContent('1,9 km');
    await fix(300);
    expect(screen.getByTestId('tracking-distance')).toHaveTextContent('1,7 km');
    expect(screen.getByTestId('tracking-compass')).toBeOnTheScreen();
  });

  it('lifts the attribution above the open panel', async () => {
    await open();
    const attribution = () => screen.getByTestId('tracking-attribution');
    expect(attribution()).toHaveStyle({ bottom: 8 });
    await fireEvent.press(gear());
    const panel = screen.getByTestId('tracking-settings-panel');
    await act(async () => {
      panel.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 300 } },
      });
    });
    expect(screen.getByTestId('tracking-attribution-button')).toBeOnTheScreen();
    expect(attribution()).toHaveStyle({ bottom: 308 });
  });

  it('gives the panel a name for the screen reader', async () => {
    await open();
    await fireEvent.press(gear());
    const panel = screen.getByTestId('tracking-settings-panel');
    expect(panel.props.role).toBe('dialog');
    expect(panel.props.accessibilityLabel).toBe('Réglages du suivi');
  });

  it('chooses "Maximum" at once, without a button to confirm', async () => {
    await open();
    await fireEvent.press(gear());
    await fireEvent.press(screen.getByRole('radio', { name: 'Maximum' }));
    expect(mockChoose).toHaveBeenCalledWith('max');
  });

  it('closes with "Fermer", with the gear, and gives "Reste" back', async () => {
    await open();
    await fireEvent.press(gear());
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByTestId('tracking-settings-panel')).toBeNull();
    expect(screen.getByTestId('tracking-footer')).toBeOnTheScreen();
    await fireEvent.press(gear());
    await fireEvent.press(gear());
    expect(screen.queryByTestId('tracking-settings-panel')).toBeNull();
  });

  it('the way back of Android closes the panel first, then asks to finish', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open();
    await fireEvent.press(gear());
    await act(async () => mockPrevent?.callback());
    expect(screen.queryByTestId('tracking-settings-panel')).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    await act(async () => mockPrevent?.callback());
    expect(alert).toHaveBeenCalledWith(
      'Terminer la sortie\u202F?',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('closes by itself when the guidance panel turns yellow', async () => {
    await open();
    await fix(1000);
    await fireEvent.press(gear());
    expect(screen.getByTestId('tracking-settings-panel')).toBeOnTheScreen();
    for (const x of [1200, 1400, 1600, 1800, 1900, 1920]) await fix(x);
    expect(screen.getByTestId('tracking-panel')).toHaveStyle({
      backgroundColor: '#FFD400',
    });
    expect(screen.queryByTestId('tracking-settings-panel')).toBeNull();
  });

  it('opened while already yellow, it stays open for this direction', async () => {
    await open();
    for (const x of [1000, 1300, 1600, 1900, 1920]) await fix(x);
    expect(screen.getByTestId('tracking-panel')).toHaveStyle({
      backgroundColor: '#FFD400',
    });
    await fireEvent.press(gear());
    await fix(1930);
    expect(screen.getByTestId('tracking-settings-panel')).toBeOnTheScreen();
  });

  it('stays open when the first position is already within 100 m of a direction', async () => {
    await open();
    // Waiting for the GPS: no position placed yet.
    await fireEvent.press(gear());
    await fix(1920);
    expect(screen.getByTestId('tracking-panel')).toHaveStyle({
      backgroundColor: '#FFD400',
    });
    expect(screen.getByTestId('tracking-settings-panel')).toBeOnTheScreen();
  });

  it('closes at a real passage to yellow after a first position that is not', async () => {
    await open();
    await fireEvent.press(gear());
    await fix(1000);
    expect(screen.getByTestId('tracking-settings-panel')).toBeOnTheScreen();
    for (const x of [1300, 1600, 1900, 1920]) await fix(x);
    expect(screen.queryByTestId('tracking-settings-panel')).toBeNull();
  });

  it('does not close for "Suivez le tracé" or a gap to the line', async () => {
    await open();
    await fix(500);
    await fireEvent.press(gear());
    await fix(520, 80);
    await fix(540, 80);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      "jusqu'au tracé",
    );
    expect(screen.getByTestId('tracking-settings-panel')).toBeOnTheScreen();
  });
});

describe('brightness during the tracking', () => {
  const mockSet = setBrightnessAsync as jest.Mock;

  it('does nothing with "Automatique"', async () => {
    await open('auto');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('raises with "Maximum", and gives back on "Terminer"', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open('max');
    expect(mockSet).toHaveBeenCalledWith(1);
    await act(async () => mockPrevent?.callback());
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () =>
      buttons.find((b) => b.text === 'Terminer')?.onPress?.(),
    );
    expect(restoreSystemBrightnessAsync).toHaveBeenCalledTimes(1);
  });

  it('gives back in the background and raises again at the return', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await open('max');
    await act(async () => appListeners.forEach((l) => l('background')));
    expect(restoreSystemBrightnessAsync).toHaveBeenCalledTimes(1);
    mockSet.mockClear();
    await act(async () => appListeners.forEach((l) => l('active')));
    expect(mockSet).toHaveBeenCalledWith(1);
  });
});
