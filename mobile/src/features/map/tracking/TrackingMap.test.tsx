// The camera of the tracking (ADR 0021, section 3; spec C4): it follows the
// track bearing, goes north up with the compass, and waits 10 s after a
// gesture of the rider. MapLibre is faked; the Camera records its moves.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { buildLine, type TrackingSource } from '@/core/tracking/trackingLine';
import { lineOf, straight, toLonLat } from '@/core/tracking/testing/fabricate';

import { distanceM } from '@/core/tracking/trackingLine';

import { boundsZoom, metersPerPoint } from './trackingGeometry';
import { TrackingSession } from './TrackingSession';

const mockEaseTo = jest.fn();
const mockFitBounds = jest.fn();
let mockMapProps: {
  onRegionWillChange?: (e: unknown) => void;
  onRegionDidChange?: (e: unknown) => void;
} = {};
const mockSources: Record<
  string,
  { features: { geometry: { coordinates: number[] } }[] }
> = {};
let mockOnFix: ((location: unknown) => void) | null = null;
let now = 1_700_000_000_000;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { forwardRef, useEffect, useImperativeHandle } =
    jest.requireActual('react');
  return {
    Map: (props: { children: ReactNode }) => {
      mockMapProps = props as typeof mockMapProps;
      useEffect(() => {
        (
          props as { onDidFinishLoadingMap?: () => void }
        ).onDidFinishLoadingMap?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <View>{props.children}</View>;
    },
    Camera: forwardRef((_props: unknown, ref: never) => {
      useImperativeHandle(ref, () => ({
        easeTo: (...a: unknown[]) => mockEaseTo(...a),
        fitBounds: (...a: unknown[]) => mockFitBounds(...a),
      }));
      return null;
    }),
    Layer: () => null,
    GeoJSONSource: (props: { id: string; data: never }) => {
      mockSources[props.id] = props.data;
      return null;
    },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  watchPositionAsync: (_options: unknown, onFix: (l: unknown) => void) => {
    mockOnFix = onFix;
    return Promise.resolve({ remove: jest.fn() });
  },
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routing/computeGuidance', () => ({
  computeTraceRoute: () => Promise.resolve({ ok: false, error: 'failed' }),
  computeMatchedEdges: () => Promise.resolve({ ok: false, error: 'failed' }),
}));

const source = (): TrackingSource => ({
  line: buildLine(lineOf(straight(2000))),
  free: [],
});

async function fix(x: number, y = 0) {
  now += 1000;
  const [lon, lat] = toLonLat([x, y]);
  await act(async () => {
    mockOnFix?.({ coords: { longitude: lon, latitude: lat, accuracy: 5 } });
  });
}

async function open() {
  await render(<TrackingSession source={source()} climb={null} zone={null} />);
  await act(async () => {});
  await fireEvent(screen.getByTestId('tracking-map'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 462 } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnFix = null;
  now = 1_700_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('camera', () => {
  it('shows the whole route while waiting, north up', async () => {
    await open();
    expect(mockFitBounds).toHaveBeenCalled();
    expect(mockEaseTo).not.toHaveBeenCalled();
  });

  it('follows the rider along the track, in the bearing of the track, rider in the lower third', async () => {
    await open();
    await fix(100);
    const last = mockEaseTo.mock.calls.at(-1)?.[0];
    // The line runs east: the map turns so that east is up.
    expect(last.bearing).toBeCloseTo(90, 0);
    expect(last.zoom).toBe(15.5);
    expect(last.duration).toBe(1000);
    expect(last.padding.top).toBe(Math.round(462 * 0.33));
  });

  it('comes closer within 100 m of the arrival', async () => {
    await open();
    for (const x of [0, 500, 1000, 1500, 1900, 1920]) await fix(x);
    expect(mockEaseTo.mock.calls.at(-1)?.[0].zoom).toBe(16.5);
  });

  it('goes north up with the compass, and back', async () => {
    await open();
    await fix(100);
    await fireEvent.press(screen.getByTestId('tracking-compass'));
    expect(mockEaseTo.mock.calls.at(-1)?.[0].bearing).toBe(0);
    await fireEvent.press(screen.getByTestId('tracking-compass'));
    expect(mockEaseTo.mock.calls.at(-1)?.[0].bearing).toBeCloseTo(90, 0);
  });

  it('shows the whole way and the rider when away from the track', async () => {
    await open();
    await fix(-500);
    expect(mockFitBounds.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('gesture of the rider', () => {
  it('pauses the camera for 10 s, then it comes back', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    await open();
    await fix(100);
    const before = mockEaseTo.mock.calls.length;
    await act(async () => {
      mockMapProps.onRegionDidChange?.({
        nativeEvent: { userInteraction: true },
      });
    });
    await fix(200);
    await fix(300);
    expect(mockEaseTo.mock.calls.length).toBe(before);
    now += 10_000;
    await act(async () => {
      jest.advanceTimersByTime(10_100);
    });
    expect(mockEaseTo.mock.calls.length).toBe(before + 1);
    await fix(400);
    expect(mockEaseTo.mock.calls.length).toBe(before + 2);
  });

  it('ignores the moves of our own camera', async () => {
    await open();
    await fix(100);
    const before = mockEaseTo.mock.calls.length;
    await act(async () => {
      mockMapProps.onRegionWillChange?.({
        nativeEvent: { userInteraction: false },
      });
      mockMapProps.onRegionDidChange?.({
        nativeEvent: { userInteraction: false },
      });
    });
    await fix(200);
    expect(mockEaseTo.mock.calls.length).toBe(before + 1);
  });
});

describe('dots of the gap line', () => {
  const dots = () =>
    mockSources['suivi-ecart']?.features.map((f) => f.geometry.coordinates) ??
    [];
  const spacing = () => {
    const [a, b] = dots();
    return distanceM(a as [number, number], b as [number, number]);
  };
  async function offTrack() {
    await open();
    await fix(1000, 500);
    await fix(1000, 500);
  }

  it('are 10 points apart at the zoom the camera aims at', async () => {
    await offTrack();
    const [bounds, options] = mockFitBounds.mock.calls.at(-1) as [
      [number, number, number, number],
      { bearing: number; padding: never },
    ];
    const zoom = boundsZoom(
      bounds,
      options.bearing,
      { width: 390, height: 462 },
      options.padding,
    );
    expect(dots().length).toBeGreaterThan(1);
    expect(spacing()).toBeCloseTo(10 * metersPerPoint(zoom, bounds[1]), 0);
  });

  it('ignore the zoom of the events of our own camera', async () => {
    await offTrack();
    const before = dots();
    await act(async () => {
      mockMapProps.onRegionDidChange?.({
        nativeEvent: { userInteraction: false, zoom: 12 },
      });
    });
    expect(dots()).toEqual(before);
  });

  it('follow the zoom of a gesture of the rider', async () => {
    await offTrack();
    const before = dots();
    await act(async () => {
      mockMapProps.onRegionDidChange?.({
        nativeEvent: { userInteraction: true, zoom: 12 },
      });
    });
    expect(dots()).not.toEqual(before);
  });
});
