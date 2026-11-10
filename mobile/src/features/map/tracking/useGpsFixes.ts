// The GPS during the tracking: `watchPositionAsync`, the classic API of
// expo-location, one position a second (ADR 0021, section 5.3). The watch is
// on only while `enabled` (not in the background, not after the end).

import * as Location from 'expo-location';
import { useEffect } from 'react';

import type { Fix } from '@/core/tracking/placement';

/** `onFix` must be stable (`useCallback`): a new one restarts the watch. */
export function useGpsFixes(enabled: boolean, onFix: (fix: Fix) => void) {
  useEffect(() => {
    if (!enabled) return;
    let removed = false;
    let subscription: Location.LocationSubscription | undefined;
    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (location) => {
        onFix({
          lon: location.coords.longitude,
          lat: location.coords.latitude,
          accuracy: location.coords.accuracy,
          at: Date.now(),
        });
      },
    )
      .then((created) => {
        if (removed) created.remove();
        else subscription = created;
      })
      .catch(() => undefined);
    return () => {
      removed = true;
      subscription?.remove();
    };
  }, [enabled, onFix]);
}
