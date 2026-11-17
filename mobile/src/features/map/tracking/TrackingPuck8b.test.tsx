// The dot of the tracking (ADR 0021, section 9, question a): the same layers
// as the map tab, at size 40, with the heading of the tracking, the accuracy
// of the last position kept, and grey without an arrow when the GPS is lost.
// MapLibre is faked; the layers and the sources record what they are given.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { buildLine, type TrackingSource } from '@/core/tracking/trackingLine';
import { lineOf, straight, toLonLat } from '@/core/tracking/testing/fabricate';

import { TrackingSession } from './TrackingSession';

const mockLayers: Record<string, any> = {};
const mockSources: Record<string, any> = {};
let mockOnFix: ((location: unknown) => void) | null = null;
let now = 1_700_000_000_000;

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    Map: (props: { children: ReactNode }) => <View>{props.children}</View>,
    Camera: forwardRef((_props: unknown, ref: never) => {
      useImperativeHandle(ref, () => ({
        easeTo: jest.fn(),
        fitBounds: jest.fn(),
      }));
      return null;
    }),
    Images: () => null,
    Layer: (props: { id: string }) => {
      mockLayers[props.id] = props;
      return null;
    },
    GeoJSONSource: (props: { id: string; children: ReactNode }) => {
      mockSources[props.id] = props;
      return <>{props.children}</>;
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

async function fix(x: number, y = 0, accuracy = 5) {
  now += 1000;
  const [lon, lat] = toLonLat([x, y]);
  await act(async () => {
    mockOnFix?.({
      coords: { longitude: lon, latitude: lat, accuracy },
      timestamp: now,
    });
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

describe('the dot of the tracking', () => {
  it('has the round of 40 and the arrow of scale 1', async () => {
    await open();
    expect(mockLayers['position-rond'].paint['circle-radius']).toBe(17);
    expect(mockLayers['position-rond'].paint['circle-stroke-width']).toBe(3);
    expect(mockLayers['position-rond'].paint['circle-color']).toBe('#1A73E8');
    expect(mockLayers['position-fleche'].layout['icon-size']).toBe(1);
  });

  it('is drawn without a point before the first position', async () => {
    await open();
    expect(mockSources.position.data.type).toBe('FeatureCollection');
  });

  it('is on the track, with the heading of the track (east) and the accuracy', async () => {
    await open();
    await fix(100, 0, 8);
    await fix(200, 3, 8);
    const point = mockSources.position.data;
    expect(point.type).toBe('Feature');
    // The line runs east: the arrow points east, whatever the course of the GPS.
    expect(point.properties.heading).toBeCloseTo(90, 0);
    // The halo is the accuracy of the last position kept.
    const r0 = point.properties.r0;
    const [, lat] = point.geometry.coordinates;
    expect(r0 * 78271.517 * Math.cos((lat * Math.PI) / 180)).toBeCloseTo(8, 6);
  });

  it('turns grey, with no arrow, when the GPS is lost', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    await open();
    await fix(100);
    await fix(200);
    expect(mockLayers['position-rond'].paint['circle-color']).toBe('#1A73E8');
    now += 12_000;
    await act(async () => {
      jest.advanceTimersByTime(12_000);
    });
    expect(mockLayers['position-rond'].paint['circle-color']).toBe('#8C8C8C');
    // No arrow at all (the filter lets nothing through).
    expect(mockLayers['position-fleche'].filter).toEqual(['boolean', false]);
    // The next position brings everything back.
    await fix(300);
    expect(mockLayers['position-rond'].paint['circle-color']).toBe('#1A73E8');
    expect(mockLayers['position-fleche'].filter).toEqual(['has', 'heading']);
  });
});
