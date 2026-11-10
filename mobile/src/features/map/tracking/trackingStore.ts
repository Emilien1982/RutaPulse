// Store of the tracking: TanStack Store around `reduceTracking` (ADR 0021,
// section 5.1). Created when the tracking screen opens, dropped with it.

import { createStore } from '@tanstack/react-store';

import {
  createTracking,
  reduceTracking,
  type TrackingEvent,
  type TrackingState,
} from '@/core/tracking/trackingState';
import type { TrackingSource } from '@/core/tracking/trackingLine';

export function createTrackingStore(source: TrackingSource, startedAt: number) {
  const store = createStore<TrackingState>(createTracking(source, startedAt));
  return {
    store,
    dispatch(event: TrackingEvent): void {
      store.setState((state) => reduceTracking(state, event));
    },
  };
}

export type TrackingStore = ReturnType<typeof createTrackingStore>;
