import type { RouteErrorKind } from '../routing/routeResponse';
import type { Bbox } from '../zones/catalogue';
import { createDraftState, reduceDraft, type Draft } from './draft';
import { findProblem } from './problem';
import { handLeg, HAND_SPEED_KMH, summarize } from './legs';

const bbox: Bbox = { lonMin: 0, latMin: 0, lonMax: 10, latMax: 10 };
const at = (id: number, lon = id, lat = 5) => ({ id, lon, lat });
const draft = (n: number): Draft => ({
  points: Array.from({ length: n }, (_, i) => at(i + 1)),
  modes: Array.from({ length: n - 1 }, () => 'path' as const),
});

describe('findProblem, two neighbouring failed legs (T5)', () => {
  const far: RouteErrorKind = 'farFromPath';

  it('aims the point shared by the two legs, not the last point added', () => {
    // Point 2 is far from a path; point 3 was added at once, target = 3.
    const found = findProblem(draft(3), [far, far], 3, bbox);
    expect(found?.pointId).toBe(2);
    expect(found?.legIndices).toEqual([0, 1]);
  });

  it('aims the shared point when the dragged point is the shared one', () => {
    expect(findProblem(draft(3), [far, far], 2, bbox)?.pointId).toBe(2);
  });

  it('aims the shared point with no target at all', () => {
    expect(findProblem(draft(3), [far, far], null, bbox)?.pointId).toBe(2);
  });

  it('with one failed leg, still aims the last action', () => {
    expect(findProblem(draft(3), [undefined, far], 3, bbox)?.pointId).toBe(3);
  });

  it('with two legs apart, takes the one of the target', () => {
    const found = findProblem(draft(4), [far, undefined, far], 4, bbox);
    expect(found?.pointId).toBe(4);
    expect(found?.legIndices).toEqual([2]);
  });

  it('outOfZone: both legs of the outside point are listed', () => {
    const d: Draft = {
      points: [at(1), at(2, 20), at(3)],
      modes: ['path', 'path'],
    };
    const found = findProblem(d, ['outOfZone', 'outOfZone'], 3, bbox);
    expect(found?.pointId).toBe(2);
    expect(found?.legIndices).toEqual([0, 1]);
  });

  it('keeps the first point outside the zone', () => {
    const d: Draft = { points: [at(1, 20)], modes: [] };
    expect(findProblem(d, [], 1, bbox)).toEqual({
      kind: 'outOfZone',
      pointId: 1,
      legIndices: [],
    });
  });
});

describe('setLegMode on the failed legs of a point (T5)', () => {
  it('one action, one undo', () => {
    let state = createDraftState();
    for (const lon of [1, 2, 3]) {
      state = reduceDraft(state, { type: 'add', lon, lat: 5 });
    }
    const pastBefore = state.past.length;
    const relinked = reduceDraft(state, {
      type: 'setLegMode',
      indices: [0, 1],
      mode: 'hand',
    });
    expect(relinked.draft.modes).toEqual(['hand', 'hand']);
    expect(relinked.past.length).toBe(pastBefore + 1);
    expect(reduceDraft(relinked, { type: 'undo' }).draft).toEqual(state.draft);
  });
});

describe('summary of a hand leg (T5)', () => {
  const d: Draft = {
    points: [
      { id: 1, lon: 6.1, lat: 48.66 },
      { id: 2, lon: 6.14, lat: 48.68 },
    ],
    modes: ['hand'],
  };

  it('estimates the duration at 10 km/h without any computed leg', () => {
    const { distanceKm, durationS } = summarize(d, [undefined]);
    expect(distanceKm).toBeGreaterThan(3);
    expect(durationS).toBeCloseTo((distanceKm / HAND_SPEED_KMH) * 3600, 5);
    expect(durationS).toBeCloseTo(
      handLeg(d.points[0]!, d.points[1]!).durationS,
    );
  });

  it('uses the average speed of the computed legs otherwise', () => {
    const two: Draft = {
      points: [...d.points, { id: 3, lon: 6.16, lat: 48.7 }],
      modes: ['path', 'hand'],
    };
    // 20 km in 1 h: 20 km/h.
    const { distanceKm, durationS } = summarize(two, [
      { distanceKm: 20, durationS: 3600 },
      undefined,
    ]);
    const handKm = distanceKm - 20;
    expect(durationS).toBeCloseTo(3600 + (handKm / 20) * 3600, 5);
  });
});

describe('a point kept by "Relier" (T5, B1)', () => {
  const far: RouteErrorKind = 'farFromPath';

  it('the sheet is about the kept point, not the point added next', () => {
    const d: Draft = { ...draft(3), modes: ['hand', 'path'], linked: [2] };
    const found = findProblem(d, [undefined, far], 3, bbox);
    expect(found?.pointId).toBe(2);
    expect(found?.legIndices).toEqual([1]);
  });

  it('without the kept point, the added point is aimed (as before)', () => {
    const d: Draft = { ...draft(3), modes: ['hand', 'path'] };
    expect(findProblem(d, [undefined, far], 3, bbox)?.pointId).toBe(3);
  });

  it('outside the zone: the rectangle decides, not the kept point', () => {
    const d: Draft = {
      points: [at(1), at(2), at(3, 20)],
      modes: ['hand', 'path'],
      linked: [2],
    };
    const found = findProblem(d, [undefined, 'outOfZone'], 3, bbox);
    expect(found?.kind).toBe('outOfZone');
    expect(found?.pointId).toBe(3);
    expect(found?.legIndices).toEqual([1]);
  });

  it('outside the zone: the shared point must really be outside', () => {
    // Legs 1-2 and 2-3 fail outOfZone, but only point 3 is outside: leg 2-3
    // was chosen by the target, and point 2 is not outside the rectangle.
    const d: Draft = {
      points: [at(1), at(2), at(3, 20)],
      modes: ['path', 'path'],
    };
    const found = findProblem(d, ['outOfZone', 'outOfZone'], 3, bbox);
    expect(found?.pointId).toBe(3);
  });
});

describe('linked points in the model (T5, B1)', () => {
  function threePoints() {
    let state = createDraftState();
    for (const lon of [1, 2, 3]) {
      state = reduceDraft(state, { type: 'add', lon, lat: 5 });
    }
    return state;
  }

  it('"Relier" sets the modes and the kept point in one action, one undo', () => {
    const state = threePoints();
    const after = reduceDraft(state, {
      type: 'setLegMode',
      indices: [0, 1],
      mode: 'hand',
      linkedPointId: 2,
    });
    expect(after.draft.linked).toEqual([2]);
    expect(after.past.length).toBe(state.past.length + 1);
    const undone = reduceDraft(after, { type: 'undo' });
    expect(undone.draft).toEqual(state.draft);
    expect(undone.draft.linked).toBeUndefined();
  });

  it('keeps the point when it is moved or when another point is added', () => {
    let state = reduceDraft(threePoints(), {
      type: 'setLegMode',
      indices: [0],
      mode: 'hand',
      linkedPointId: 2,
    });
    state = reduceDraft(state, { type: 'move', id: 2, lon: 2.5, lat: 5 });
    state = reduceDraft(state, { type: 'add', lon: 4, lat: 5 });
    expect(state.draft.linked).toEqual([2]);
  });

  it('"Boucler" keeps the kept point, and "Annuler" undoes the loop only', () => {
    const relinked = reduceDraft(threePoints(), {
      type: 'setLegMode',
      indices: [0],
      mode: 'hand',
      linkedPointId: 2,
    });
    const looped = reduceDraft(relinked, { type: 'loop' });
    expect(looped.draft.points).toHaveLength(4);
    expect(looped.draft.linked).toEqual([2]);
    const undone = reduceDraft(looped, { type: 'undo' });
    expect(undone.draft).toEqual(relinked.draft);
    expect(undone.draft.linked).toEqual([2]);
  });

  it('removing the point forgets it', () => {
    let state = reduceDraft(threePoints(), {
      type: 'setLegMode',
      indices: [0],
      mode: 'hand',
      linkedPointId: 2,
    });
    state = reduceDraft(state, { type: 'remove', id: 2 });
    expect(state.draft.linked).toBeUndefined();
  });
});
