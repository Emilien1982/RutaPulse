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

  // Projection written another way (tangent form), at the zoom z of a map
  // of 512-point tiles: size in points of the box on screen.
  const projected = (box: number[], z: number) => {
    const world = 512 * 2 ** z;
    const y = (lat: number) =>
      ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * world;
    return {
      w: ((box[2]! - box[0]!) / 360) * world,
      h: y(box[1]!) - y(box[3]!),
    };
  };
  const fits = (box: number[], z: number, screen = SCREEN, c = COVERED) => {
    const { w, h } = projected(box, z);
    const eps = 1e-6;
    return (
      w <= screen.width - 96 + eps &&
      h <= screen.height - c.top - c.bottom - 96 + eps
    );
  };

  it.each([
    [[6, 48.6, 6.3, 48.62]],
    [[6, 48, 6.01, 48.4]],
    [[6.18, 48.69, 6.1842, 48.69]],
    [[5.9, 48.5, 6.4, 48.9]],
  ])('the box %j fits at the zoom chosen, and not at +0.1', (box) => {
    const { zoom } = fitView(box as never, SCREEN, COVERED);
    expect(fits(box, zoom)).toBe(true);
    if (zoom < FIT_MAX_ZOOM) expect(fits(box, zoom + 0.1)).toBe(false);
  });

  it('shows the 323 m route of the comparison whole on an iPhone 17', () => {
    const iphone = { width: 402, height: 874 };
    const box = [6.18, 48.69, 6.1842, 48.69];
    const { zoom } = fitView(box as never, iphone, { top: 112, bottom: 230 });
    // 306 points of width are free; the box is 307 m: zoom 15.6.
    expect(zoom).toBeCloseTo(15.6, 1);
    expect(fits(box, zoom, iphone, { top: 112, bottom: 230 })).toBe(true);
  });
});
