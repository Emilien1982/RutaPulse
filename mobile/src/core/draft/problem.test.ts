import type { Bbox } from '../zones/catalogue';
import type { Draft } from './draft';
import { findProblem } from './problem';

const bbox: Bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };
const inside = (id: number) => ({ id, lon: 6.1 + id / 100, lat: 48.7 });
const outside = (id: number) => ({ id, lon: 7, lat: 48.7 });

function draft(points: Draft['points']): Draft {
  return { points, modes: points.slice(1).map(() => 'path' as const) };
}

describe('findProblem', () => {
  it('is undefined without error', () => {
    expect(findProblem(draft([inside(1), inside(2)]), [], 2, bbox)).toBe(
      undefined,
    );
    expect(findProblem(draft([]), [], null, bbox)).toBe(undefined);
  });

  it('refuses a first point outside the zone, without any leg', () => {
    expect(findProblem(draft([outside(1)]), [], 1, bbox)).toEqual({
      kind: 'outOfZone',
      pointId: 1,
      legIndices: [],
    });
  });

  it('accepts a first point inside the zone', () => {
    expect(findProblem(draft([inside(1)]), [], 1, bbox)).toBe(undefined);
  });

  it('aims at the point of the last action', () => {
    const d = draft([inside(1), inside(2), inside(3)]);
    expect(findProblem(d, [undefined, 'farFromPath'], 3, bbox)).toEqual({
      kind: 'farFromPath',
      pointId: 3,
      legIndices: [1],
    });
  });

  it('takes both legs of a moved middle point', () => {
    const d = draft([inside(1), inside(2), inside(3)]);
    expect(findProblem(d, ['farFromPath', 'farFromPath'], 2, bbox)).toEqual({
      kind: 'farFromPath',
      pointId: 2,
      legIndices: [0, 1],
    });
  });

  it('marks the end that is outside the zone, not the other one', () => {
    // The first point is outside, the second was just added inside.
    const d = draft([outside(1), inside(2)]);
    expect(findProblem(d, ['outOfZone'], 2, bbox)?.pointId).toBe(1);
  });

  it('marks the target when it is the one outside the zone', () => {
    const d = draft([inside(1), outside(2)]);
    expect(findProblem(d, ['outOfZone'], 2, bbox)?.pointId).toBe(2);
  });

  it('falls back to the arrival of the last failed leg', () => {
    const d = draft([inside(1), inside(2), inside(3)]);
    expect(findProblem(d, ['noRoute', 'noRoute'], null, bbox)?.pointId).toBe(3);
    expect(findProblem(d, ['noRoute'], 9, bbox)?.pointId).toBe(2);
  });

  it('keeps the kind of the engine error', () => {
    const d = draft([inside(1), inside(2)]);
    expect(findProblem(d, ['zoneUnreadable'], 2, bbox)?.kind).toBe(
      'zoneUnreadable',
    );
  });
});
