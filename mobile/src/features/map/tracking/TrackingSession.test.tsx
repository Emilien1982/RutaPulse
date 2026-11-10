// The tracking screen (ADR 0021, section 5; spec C4, C5, C7, C8): panel
// states, "Terminer" and the way back, the GPS and the screen kept awake
// only while tracking, the pause in the background. MapLibre, the router, the
// GPS and the engine are faked.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';

import { buildLine, type TrackingSource } from '@/core/tracking/trackingLine';
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

let appListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrevent = null;
  mockOnFix = null;
  appListener = null;
  now = 1_700_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockWatch.mockImplementation((_options, onFix) => {
    mockOnFix = onFix;
    return Promise.resolve({ remove: mockRemove });
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    listener: (state: AppStateStatus) => void,
  ) => {
    appListener = listener;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function open(tracking: TrackingSource = source()) {
  await render(<TrackingSession source={tracking} climb={null} zone={null} />);
  await act(async () => {});
}

// A position at (x, y) meters from the start of the line, `gap` ms after the last.
async function fix(x: number, y = 0, gap = 1000) {
  now += gap;
  const [lon, lat] = toLonLat([x, y]);
  await act(async () => {
    mockOnFix?.({ coords: { longitude: lon, latitude: lat, accuracy: 5 } });
  });
}

describe('waiting for the GPS', () => {
  it('shows the waiting panel and the figures of the whole route, GPS on, screen awake', async () => {
    await open();
    expect(screen.getByText('Recherche du GPS…')).toBeOnTheScreen();
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Restez à découvert quelques secondes.',
    );
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent(
      '2,0 km',
    );
    expect(screen.getByTestId('tracking-climb')).toHaveTextContent('—');
    expect(screen.getByText('Reste')).toBeOnTheScreen();
    expect(screen.getByText('D+ restant')).toBeOnTheScreen();
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockWatch.mock.calls[0]?.[0]).toMatchObject({
      timeInterval: 1000,
      distanceInterval: 0,
    });
    expect(mockKeepOn).toHaveBeenCalledTimes(1);
    expect(mockPrevent?.enabled).toBe(true);
  });

  it('has no gear wheel (phase 8b)', async () => {
    await open();
    expect(screen.queryByTestId('tracking-settings')).toBeNull();
  });
});

describe('panel states', () => {
  it('announces the arrival when no direction is left until the end of the line', async () => {
    await open();
    await fix(100);
    // The engine gave nothing: the whole line is a stretch without direction,
    // up to the arrival (panel rule 4 of the ADR: screen 5).
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      'Arrivée',
    );
    expect(screen.getByTestId('tracking-distance')).toHaveTextContent('1,9 km');
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent(
      '1,9 km',
    );
  });

  it('shows the reason of a stretch drawn by hand', async () => {
    await open(source([{ fromM: 0, toM: 1200, reason: 'hand' }]));
    await fix(100);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      'Suivez le tracé',
    );
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Tronçon tracé à la main',
    );
    expect(screen.getByTestId('tracking-distance')).toHaveTextContent('1,1 km');
  });

  it('shows "Hors de la zone téléchargée" for a stretch outside the zone', async () => {
    await open(source([{ fromM: 0, toM: 1200, reason: 'outOfZone' }]));
    await fix(100);
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Hors de la zone téléchargée',
    );
  });

  it('turns yellow at 100 m or less from the arrival, white before', async () => {
    await open();
    await fix(1000);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      'Arrivée',
    );
    expect(screen.getByTestId('tracking-panel')).toHaveStyle({
      backgroundColor: '#FFFFFF',
    });
    await fix(1100);
    await fix(1200);
    await fix(1300);
    await fix(1400);
    await fix(1500);
    await fix(1600);
    await fix(1700);
    await fix(1800);
    await fix(1900);
    await fix(1920);
    expect(screen.getByTestId('tracking-panel')).toHaveStyle({
      backgroundColor: '#FFD400',
    });
  });

  it('shows the start when far from the line (approach)', async () => {
    await open();
    await fix(-500);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      "jusqu'au départ",
    );
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Le guidage commence au départ.',
    );
    expect(screen.getByTestId('tracking-distance')).toHaveTextContent('500 m');
  });

  it('shows the gap to the line after two fixes off the track, then goes back on', async () => {
    await open(source([{ fromM: 0, toM: 1200, reason: 'hand' }]));
    await fix(500);
    await fix(520, 80);
    await fix(540, 80);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      "jusqu'au tracé",
    );
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Le guidage reprend sur le tracé.',
    );
    expect(screen.getByTestId('tracking-panel')).toHaveStyle({
      backgroundColor: '#FFFFFF',
    });
    await fix(560, 5);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      'Suivez le tracé',
    );
  });

  it('shows the message after 30 s without any GPS position', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    await open();
    now += 31_000;
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Le GPS ne répond pas. Vérifiez que la position est activée.',
    );
  });

  it('says "Signal GPS perdu" after 10 s without a position', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    await open();
    await fix(100);
    now += 11_000;
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Signal GPS perdu',
    );
  });
});

describe('"Terminer" and the way back (C7)', () => {
  const alertButtons = () =>
    (Alert.alert as jest.Mock).mock.calls[0]?.[2] as {
      text: string;
      style?: string;
      onPress?: () => void;
    }[];

  it('asks to confirm, with the texts of the mockup', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open();
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message] = (Alert.alert as jest.Mock).mock
      .calls[0] as string[];
    expect(title).toBe('Terminer la sortie ?');
    expect(message).toBe(
      "Le suivi s'arrête et le résumé de la sortie s'affiche.",
    );
    expect((Alert.alert as jest.Mock).mock.calls[0]?.[3]).toEqual({
      cancelable: true,
    });
    expect(alertButtons().map((b) => [b.text, b.style])).toEqual([
      ['Continuer', 'cancel'],
      ['Terminer', 'destructive'],
    ]);
    // "Continuer": nothing changes.
    expect(screen.getByTestId('tracking-panel')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('opens the same box for the way back of the system', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open();
    expect(mockPrevent?.enabled).toBe(true);
    await act(async () => mockPrevent?.callback());
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title] = (Alert.alert as jest.Mock).mock.calls[0] as string[];
    expect(title).toBe('Terminer la sortie ?');
  });

  it('goes straight back to the Infos screen under 100 m ridden', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open();
    await fix(10);
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    await act(async () => {
      alertButtons()[1]?.onPress?.();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ride-end')).toBeNull();
    // Stopped: GPS off, screen released.
    expect(mockRemove).toHaveBeenCalled();
    expect(mockKeepOff).toHaveBeenCalledTimes(1);
  });

  it('shows the end screen after 100 m ridden, stops the GPS and frees the screen', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open();
    await fix(0);
    await fix(60);
    await fix(120);
    await fix(180);
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    await act(async () => {
      alertButtons()[1]?.onPress?.();
    });
    expect(screen.getByTestId('ride-end')).toBeOnTheScreen();
    expect(screen.getByText('SORTIE TERMINÉE')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockKeepOff).toHaveBeenCalledTimes(1);
    expect(mockPrevent?.enabled).toBe(false);
    await fireEvent.press(screen.getByTestId('ride-close'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('arrival (C6)', () => {
  it('ends the tracking at 30 m from the end after 90 % of the line', async () => {
    await open();
    for (const x of [0, 400, 800, 1200, 1600, 1850]) await fix(x);
    expect(screen.queryByTestId('ride-end')).toBeNull();
    await fix(1980);
    expect(screen.getByTestId('ride-end')).toBeOnTheScreen();
    expect(screen.getByText('ARRIVÉE !')).toBeOnTheScreen();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockKeepOff).toHaveBeenCalledTimes(1);
  });
});

describe('in the background (C8)', () => {
  it('pauses the GPS, and resumes it without losing the progress', async () => {
    await open();
    await fix(0);
    await fix(500);
    await fix(1000);
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent(
      '1,0 km',
    );
    expect(mockWatch).toHaveBeenCalledTimes(1);

    await act(async () => appListener?.('background'));
    expect(mockRemove).toHaveBeenCalledTimes(1);

    now += 60_000;
    await act(async () => appListener?.('active'));
    await act(async () => {});
    expect(mockWatch).toHaveBeenCalledTimes(2);
    // The progress is intact until the next position.
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent(
      '1,0 km',
    );
    await fix(1100);
    expect(screen.getByTestId('tracking-remaining')).toHaveTextContent('900 m');
  });

  it('does not pause for the inactive state of iOS', async () => {
    await open();
    await act(async () => appListener?.('inactive'));
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
