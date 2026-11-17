// The brightness of the screen during the tracking (ADR 0021, section 8.3).
// The only file that imports `expo-brightness`.

import {
  getBrightnessAsync,
  restoreSystemBrightnessAsync,
  setBrightnessAsync,
} from 'expo-brightness';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import {
  wantsMaxBrightness,
  type BrightnessChoice,
} from '@/core/tracking/brightness';
import type { TrackingStatus } from '@/core/tracking/trackingState';

/**
 * Android changes the window of the app only: giving it back is one call.
 * iOS changes the whole phone: the value read before is written back.
 * A failing call leaves the brightness as it is.
 */
function createBrightness() {
  let raised = false;
  // Counts the changes of mind: a slow reading must not raise after a release.
  let turn = 0;
  let kept: number | null = null;

  return {
    async raise(): Promise<void> {
      if (raised) return;
      raised = true;
      const mine = ++turn;
      try {
        if (Platform.OS === 'ios') {
          const before = await getBrightnessAsync();
          if (mine !== turn) return;
          kept = before;
        }
        await setBrightnessAsync(1);
      } catch {
        // the brightness stays as it is
      }
    },
    async release(): Promise<void> {
      if (!raised) return;
      raised = false;
      turn += 1;
      try {
        if (Platform.OS === 'ios') {
          const before = kept;
          kept = null;
          if (before !== null) await setBrightnessAsync(before);
        } else {
          await restoreSystemBrightnessAsync();
        }
      } catch {
        // the brightness stays as it is
      }
    },
  };
}

/**
 * Raises the brightness while the tracking runs with "Maximum" and gives it
 * back otherwise: choice back to "Automatique", end, summary, leaving the
 * screen. In the background iOS gives it back at once, in the listener of
 * `AppState`; the return to the foreground raises it again through the status
 * of the tracking, which goes back to "tracking".
 */
export function useTrackingBrightness(
  choice: BrightnessChoice,
  status: TrackingStatus,
): void {
  const brightness = useRef<ReturnType<typeof createBrightness>>(null);
  brightness.current ??= createBrightness();
  const wanted = wantsMaxBrightness(choice, status);

  useEffect(() => {
    const control = brightness.current;
    if (!control) return;
    if (!wanted) {
      void control.release();
      return;
    }
    void control.raise();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'background') void control.release();
    });
    return () => app.remove();
  }, [wanted]);

  // Leaving the screen.
  useEffect(
    () => () => {
      void brightness.current?.release();
    },
    [],
  );
}
