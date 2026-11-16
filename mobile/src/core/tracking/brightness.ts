// The brightness wanted during the tracking (ADR 0021, section 8.3).

import type { TrackingStatus } from './trackingState';

export type BrightnessChoice = 'auto' | 'max';

/**
 * True only when the rider chose "Maximum" and the tracking runs. Paused (in
 * the background) and ended (the summary) both mean: give the brightness back.
 */
export function wantsMaxBrightness(
  choice: BrightnessChoice,
  status: TrackingStatus,
): boolean {
  return choice === 'max' && status === 'tracking';
}
