import { FIT_MAX_ZOOM, fitView } from './fitView';

const SCREEN = { width: 390, height: 800 };
const COVERED = { top: 112, bottom: 200 };

describe('fitView', () => {
  it('gives the margin of 48 plus the covered parts as padding', () => {
    const { padding } = fitView([6, 48, 6.1, 48.1], SCREEN, COVERED);
    expect(padding).toEqual({ top: 160, bottom: 248, left: 48, right: 48 });
  });

  it('is at zoom 17 at most, for a tiny or a flat box', () => {
    expect(fitView([6.18, 48.69, 6.1802, 48.69], SCREEN, COVERED).zoom).toBe(
      FIT_MAX_ZOOM,
    );
    expect(fitView([6.18, 48.69, 6.18, 48.69], SCREEN, COVERED).zoom).toBe(17);
  });

  it('fits a wide box in the visible width, to the zoom below', () => {
    const { zoom, center } = fitView([6, 48.6, 6.3, 48.62], SCREEN, COVERED);
    // 0.3 deg of 360 deg: 256 * 2^z * 0.3 / 360 must fit in 390 - 96.
    const width = (256 * 2 ** zoom * 0.3) / 360;
    expect(width).toBeLessThanOrEqual(390 - 96 + 1e-6);
    expect(width).toBeGreaterThan((390 - 96) * 0.99);
    expect(center[0]).toBeCloseTo(6.15, 6);
  });

  it('fits a tall box in the visible height', () => {
    const { zoom } = fitView([6, 48, 6.01, 48.4], SCREEN, COVERED);
    const mercY = (lat: number) =>
      0.5 -
      Math.log(
        (1 + Math.sin((lat * Math.PI) / 180)) /
          (1 - Math.sin((lat * Math.PI) / 180)),
      ) /
        (4 * Math.PI);
    const height = 256 * 2 ** zoom * (mercY(48) - mercY(48.4));
    expect(height).toBeLessThanOrEqual(800 - 160 - 248 + 1e-6);
    expect(height).toBeGreaterThan((800 - 408) * 0.99);
  });
});
