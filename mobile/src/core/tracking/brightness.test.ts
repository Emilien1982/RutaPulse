import { wantsMaxBrightness } from './brightness';
import type { TrackingStatus } from './trackingState';

describe('wantsMaxBrightness', () => {
  it('is true only for "Maximum" while tracking', () => {
    expect(wantsMaxBrightness('max', 'tracking')).toBe(true);
  });

  it.each<TrackingStatus>(['tracking', 'paused', 'ended'])(
    'is false for "Automatique" (status %s)',
    (status) => {
      expect(wantsMaxBrightness('auto', status)).toBe(false);
    },
  );

  it.each<TrackingStatus>(['paused', 'ended'])(
    'is false for "Maximum" when the status is %s (background, summary)',
    (status) => {
      expect(wantsMaxBrightness('max', status)).toBe(false);
    },
  );
});
