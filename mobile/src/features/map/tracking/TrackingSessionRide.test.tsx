// The real ascent at the end of the ride (ADR 0021, section 4; spec C6, C7):
// one `height` request, none during the tracking. The engine is faked.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, AppState } from 'react-native';
import type { ReactNode } from 'react';

import { buildLine, type TrackingSource } from '@/core/tracking/trackingLine';
import { lineOf, straight, toLonLat } from '@/core/tracking/testing/fabricate';

import type { Zone } from '@/core/zones/catalogue';

import { TrackingSession } from './TrackingSession';

const mockBack = jest.fn();
const mockRemove = jest.fn();
const mockWatch = jest.fn();
const mockKeepOn = jest.fn();
const mockKeepOff = jest.fn();
let mockOnFix: ((location: unknown) => void) | null = null;
let now = 1_700_000_000_000;
// Positions kept so far, and the last x: the start rule wants the 2nd position at a plausible speed.
let fixCount = 0;
let lastX = 0;

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
  usePreventRemove: () => undefined,
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
const mockHeights = jest.fn();
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: (...args: unknown[]) => mockHeights(...args),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockOnFix = null;
  now = 1_700_000_000_000;
  fixCount = 0;
  lastX = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockWatch.mockImplementation((_options, onFix) => {
    mockOnFix = onFix;
    return Promise.resolve({ remove: mockRemove });
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(
    () =>
      ({
        remove: jest.fn(),
      }) as never,
  );
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const zone = {
  id: 'z',
  name: 'Zone',
  version: 1,
  bbox: { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49 },
} as Zone;

async function open(withZone: Zone | null = zone) {
  await render(
    <TrackingSession
      source={source()}
      climb={null}
      zone={withZone}
      name="Boucle"
    />,
  );
  await act(async () => {});
}

async function fix(x: number, gap = 1000) {
  now += Math.max(gap, fixCount === 1 ? Math.abs(x - lastX) * 100 : 0);
  fixCount += 1;
  lastX = x;
  const [lon, lat] = toLonLat([x, 0]);
  await act(async () => {
    mockOnFix?.({ coords: { longitude: lon, latitude: lat, accuracy: 5 } });
  });
}

async function finish() {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.[1]?.onPress?.();
  });
  await fireEvent.press(screen.getByTestId('tracking-finish'));
  await act(async () => {});
}

describe('the real ascent', () => {
  it('asks the engine nothing during the tracking, then once at "Terminer"', async () => {
    let answer: (value: unknown) => void = () => {};
    mockHeights.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await open();
    for (const x of [0, 60, 120, 180]) await fix(x);
    expect(mockHeights).not.toHaveBeenCalled();

    await finish();
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(mockHeights.mock.calls[0]?.[0]).toHaveLength(4);
    expect(screen.getByText('SORTIE TERMINÉE')).toBeOnTheScreen();
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('…');
    expect(screen.getByTestId('ride-distance')).toHaveTextContent('180 m');
    expect(screen.getByText('Boucle')).toBeOnTheScreen();

    await act(async () => {
      answer({
        ok: true,
        profile: [
          [0, 100],
          [90, 130],
          [180, 120],
        ],
      });
    });
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('30 m');
    expect(mockHeights).toHaveBeenCalledTimes(1);
  });

  it('shows "—" when the engine fails', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await open();
    for (const x of [0, 60, 120, 180]) await fix(x);
    await finish();
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('—');
  });

  it('shows "—" without asking when there is no zone in service', async () => {
    await open(null);
    for (const x of [0, 60, 120, 180]) await fix(x);
    await finish();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('—');
  });

  it('shows "—" when a position is outside the zone', async () => {
    await open({
      ...zone,
      bbox: { lonMin: 0, latMin: 0, lonMax: 1, latMax: 1 },
    });
    for (const x of [0, 60, 120, 180]) await fix(x);
    await finish();
    expect(mockHeights).not.toHaveBeenCalled();
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('—');
  });

  it('ends on arrival: GPS off, screen freed, one request, "ARRIVÉE !"', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await open();
    for (const x of [0, 400, 800, 1200, 1600, 1850, 1980]) await fix(x);
    expect(screen.getByText('ARRIVÉE !')).toBeOnTheScreen();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockKeepOff).toHaveBeenCalledTimes(1);
    expect(mockHeights).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('ride-close'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
