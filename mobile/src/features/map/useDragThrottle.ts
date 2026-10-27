// The only file that imports Pacer (ADR 0016, section 9). If Pacer breaks,
// only this file changes.

import { useThrottler } from '@tanstack/react-pacer';

export const DRAG_WAIT_MS = 200;

/** Runs `run` at most once per 200 ms: at the start and at the end of a window. */
export function useDragThrottle<T>(run: (value: T) => void) {
  const throttler = useThrottler(run, {
    wait: DRAG_WAIT_MS,
    leading: true,
    trailing: true,
  });
  return { maybeExecute: throttler.maybeExecute, cancel: throttler.cancel };
}
