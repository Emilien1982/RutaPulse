// The margins of the camera with the settings panel open (mockup 31b: the
// position stays visible above the panel).
import { fitPadding, followPadding } from './trackingGeometry';

const RIDER_RADIUS = 15;

// The center of the rider: the middle of the free frame of the map.
function riderCenter(height: number, inset: number) {
  const { top, bottom } = followPadding(height, inset);
  return top + (height - top - bottom) / 2;
}

describe('followPadding', () => {
  it('is a third of the map, nothing at the bottom, without a panel', () => {
    expect(followPadding(600, 0)).toEqual({
      top: 198,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('takes a third of what the panel leaves, and the panel at the bottom', () => {
    const padding = followPadding(700, 392);
    expect(padding.bottom).toBe(392);
    expect(padding.top).toBe(Math.round(308 * 0.33));
  });

  it.each([
    ['iPhone SE', 435, 350],
    ['a usual phone', 600, 384],
    ['a tall phone', 700, 392],
    ['a screen of 667 high', 667, 392],
  ])('keeps the rider above the panel (%s)', (_name, height, inset) => {
    expect(riderCenter(height, inset)).toBeLessThan(
      height - inset - RIDER_RADIUS,
    );
  });

  it('never gives a negative margin, even on a tiny map', () => {
    const padding = followPadding(100, 500);
    expect(padding.bottom).toBe(100);
    expect(padding.top).toBe(0);
  });
});

describe('fitPadding', () => {
  it('is the usual margins without a panel', () => {
    expect(fitPadding(600, 0)).toEqual({
      top: 80,
      bottom: 80,
      left: 60,
      right: 60,
    });
  });

  it('puts 40 above and the panel and 40 below with a panel', () => {
    expect(fitPadding(700, 300)).toEqual({
      top: 40,
      bottom: 340,
      left: 60,
      right: 60,
    });
  });

  it('keeps the whole frame above the panel when there is room', () => {
    for (const [height, inset] of [
      [700, 392],
      [600, 384],
      [435, 350],
    ] as const) {
      const { top, bottom } = fitPadding(height, inset);
      expect(height - bottom).toBeLessThanOrEqual(height - inset);
      expect(height - bottom - top).toBeGreaterThan(0);
    }
  });

  it('is cut on a small map and still leaves a frame', () => {
    const { top, bottom } = fitPadding(400, 392);
    expect(bottom).toBe(359);
    expect(400 - top - bottom).toBeGreaterThan(0);
    expect(fitPadding(30, 500).bottom).toBe(0);
  });
});
