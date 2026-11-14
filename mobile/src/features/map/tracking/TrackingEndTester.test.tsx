// Tester's checks of T4, written from the spec (C6, C7) and ADR 0021 (4, 5.2).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { t } from '@/core/i18n/t';
import type { ReactNode } from 'react';

import { buildLine, type TrackingSource } from '@/core/tracking/trackingLine';
import { createTracking, reduceTracking } from '@/core/tracking/trackingState';
import {
  lineOf,
  loop,
  straight,
  toLonLat,
  rideAlong,
} from '@/core/tracking/testing/fabricate';
import type { Zone } from '@/core/zones/catalogue';

import { RideSummary } from './RideSummary';
import { TrackingSession } from './TrackingSession';

const mockBack = jest.fn();
let mockPrevent: { enabled: boolean; cb: () => void } | null = null;
let mockOnFix: ((location: unknown) => void) | null = null;
const mockHeights = jest.fn();
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
  usePreventRemove: (enabled: boolean, cb: () => void) => {
    mockPrevent = { enabled, cb };
  },
}));
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  watchPositionAsync: (_o: unknown, onFix: (l: unknown) => void) => {
    mockOnFix = onFix;
    return Promise.resolve({ remove: jest.fn() });
  },
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computeHeights: (...a: unknown[]) => mockHeights(...a),
}));
jest.mock('@/shared-data/routing/computeGuidance', () => ({
  computeTraceRoute: () => Promise.resolve({ ok: false, error: 'failed' }),
  computeMatchedEdges: () => Promise.resolve({ ok: false, error: 'failed' }),
}));

const zone = {
  id: 'z',
  name: 'Zone',
  version: 1,
  bbox: { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49 },
} as Zone;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrevent = null;
  mockOnFix = null;
  now = 1_700_000_000_000;
  fixCount = 0;
  lastX = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

// C6 at the rules level: 30 m from the end AND after 90 % of the route.
function run(path: ReturnType<typeof straight>, toM?: number) {
  let s = createTracking(
    { line: buildLine(lineOf(path)), free: [] },
    1_700_000_000_000,
  );
  for (const fix of rideAlong(path, { toM }))
    s = reduceTracking(s, { type: 'fix', fix });
  return s;
}

describe('C6 arrival rule', () => {
  it('arrives at the end of a straight route', () => {
    const s = run(straight(2000));
    expect(s.status).toBe('ended');
    expect(s.end).toBe('arrived');
  });
  it('does not arrive 60 m before the end (outside 30 m)', () => {
    const s = run(straight(2000), 1940);
    expect(s.status).toBe('tracking');
  });
  it('arrives 20 m before the end (inside 30 m)', () => {
    const s = run(straight(2000), 1980);
    expect(s.end).toBe('arrived');
  });
  it('a loop does not end at the start: the first positions are at the finish line', () => {
    const path = loop(300);
    const s = run(path, 100);
    expect(s.status).toBe('tracking');
  });
  it('a loop ends when ridden all the way round', () => {
    const s = run(loop(300));
    expect(s.end).toBe('arrived');
  });
});

describe('C6/C7 the end screen from a session', () => {
  const src = (): TrackingSource => ({
    line: buildLine(lineOf(straight(2000))),
    free: [],
  });
  async function open() {
    await render(
      <TrackingSession source={src()} climb={null} zone={zone} name="Essai" />,
    );
    await act(async () => {});
  }
  async function fix(x: number) {
    now += Math.max(1000, fixCount === 1 ? Math.abs(x - lastX) * 100 : 0);
    fixCount += 1;
    lastX = x;
    const [lon, lat] = toLonLat([x, 0]);
    await act(async () => {
      mockOnFix?.({ coords: { longitude: lon, latitude: lat, accuracy: 5 } });
    });
  }
  function confirmFinish() {
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, b) => b?.[1]?.onPress?.());
  }

  it('arrival: title, distance rounded to 10 m, duration with pauses, one height request', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await open();
    for (const x of [0, 500, 1000, 1500, 1990]) await fix(x);
    expect(screen.getByText('ARRIVÉE !')).toBeOnTheScreen();
    expect(screen.getByTestId('ride-distance')).toHaveTextContent('2,0 km');
    expect(screen.getByTestId('ride-duration')).toHaveTextContent('1 min');
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('—');
  });

  it('Terminer confirmed after 300 m: SORTIE TERMINÉE with 300 m and a duration by the clock', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await open();
    for (const x of [0, 100, 200, 300]) await fix(x);
    now += 60_000; // a pause: the clock keeps running
    confirmFinish();
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    await act(async () => {});
    expect(screen.getByText('SORTIE TERMINÉE')).toBeOnTheScreen();
    expect(screen.queryByText('ARRIVÉE !')).toBeNull();
    expect(screen.getByTestId('ride-distance')).toHaveTextContent('300 m');
    expect(screen.getByTestId('ride-duration')).toHaveTextContent('1 min');
  });

  it('Terminer not confirmed (Continuer) stays on the tracking', async () => {
    await open();
    for (const x of [0, 200, 400]) await fix(x);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByTestId('tracking-finish'));
    expect(screen.queryByTestId('ride-end')).toBeNull();
  });

  it('Android back while tracking opens the same box; on the summary it is free', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await open();
    for (const x of [0, 200, 400]) await fix(x);
    expect(mockPrevent?.enabled).toBe(true);
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockPrevent?.cb();
    expect(spy.mock.calls[0]?.[0]).toBe(t('tracking.finishTitle'));
    spy.mockImplementation((_t, _m, b) => b?.[1]?.onPress?.());
    await act(async () => mockPrevent?.cb());
    await act(async () => {});
    expect(screen.getByText('SORTIE TERMINÉE')).toBeOnTheScreen();
    expect(mockPrevent?.enabled).toBe(false);
  });

  it('Fermer calls router.back()', async () => {
    mockHeights.mockResolvedValue({ ok: false, error: 'failed' });
    await open();
    for (const x of [0, 500, 1000, 1500, 1990]) await fix(x);
    await fireEvent.press(screen.getByTestId('ride-close'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('RideSummary figures', () => {
  const show = (p: Partial<React.ComponentProps<typeof RideSummary>>) =>
    render(
      <RideSummary
        arrived
        distanceM={1234}
        durationS={3600}
        ascentM={5}
        onClose={() => {}}
        {...p}
      />,
    );
  it.each([
    [0, '0 m'],
    [4, '0 m'],
    [5, '10 m'],
    [436, '440 m'],
    [999, '1,0 km'],
    [1000, '1,0 km'],
    [42_195, '42,2 km'],
  ])('%d m is shown "%s"', async (m, expected) => {
    await show({ distanceM: m });
    expect(screen.getByTestId('ride-distance')).toHaveTextContent(expected);
  });
  it('duration 0 s, 59 s, 3 h 5 min', async () => {
    const v = await show({ durationS: 3 * 3600 + 5 * 60 });
    expect(screen.getByTestId('ride-duration')).toHaveTextContent('3 h 05');
    v.unmount();
  });
  it.each([
    [undefined, '…'],
    [null, '—'],
    [433, '433 m'],
    [1250, '1\u202F250 m'],
  ])('ascent %s is shown "%s"', async (ascentM, expected) => {
    await show({ ascentM });
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent(expected);
  });
});
