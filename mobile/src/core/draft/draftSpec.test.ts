// Tester tests, written from the spec (phase 4: C2, C4-C8, C10) and ADR 0016
// section 1, plus the pilot decisions (middle removal, loop at departure,
// multi-leg setLegMode).
import { formatDuration } from '../routing/formatRoute';
import {
  createDraftState,
  reduceDraft,
  type DraftAction,
  type DraftState,
} from './draft';
import { handLeg, listLegs, summarize, type LegResult } from './legs';
import * as draftModule from './draft';

const run = (actions: DraftAction[], from = createDraftState()): DraftState =>
  actions.reduce(reduceDraft, from);
const add = (lon: number, lat: number): DraftAction => ({
  type: 'add',
  lon,
  lat,
});
const coords = (s: DraftState) => s.draft.points.map((p) => [p.lon, p.lat]);
const idAt = (s: DraftState, i: number) => s.draft.points[i]!.id;

// Reference: with the earth radius 6371.0088 km (IUGG mean), one degree of
// arc on the equator = 2*pi*6371.0088/360 = 111.19493 km (hand calculation).
const DEG_KM = 111.19493;

// Four points on the equator, 0.01 deg apart (1.1119493 km each).
const four = () => run([add(0, 0), add(0.01, 0), add(0.02, 0), add(0.03, 0)]);

describe('add (C2, ADR 0016 s1)', () => {
  it('starts empty', () => {
    const s = createDraftState();
    expect(s.draft.points).toEqual([]);
    expect(s.draft.modes).toEqual([]);
    expect(s.selected).toBeNull();
    expect(s.nextMode).toBe('path');
  });
  it('first point has no leg; each next adds one leg at the end', () => {
    const s1 = run([add(1, 2)]);
    expect(s1.draft.points).toHaveLength(1);
    expect(s1.draft.modes).toEqual([]);
    const s3 = run([add(3, 4), add(5, 6)], s1);
    expect(coords(s3)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(s3.draft.modes).toEqual(['path', 'path']);
  });
  it('gives distinct ids', () => {
    const s = four();
    expect(new Set(s.draft.points.map((p) => p.id)).size).toBe(4);
  });
  it('the new leg takes the chosen mode, earlier legs keep theirs (C7)', () => {
    const s = run([
      add(0, 0),
      add(0.01, 0),
      { type: 'chooseMode', mode: 'hand' },
      add(0.02, 0),
      { type: 'chooseMode', mode: 'path' },
      add(0.03, 0),
    ]);
    expect(s.draft.modes).toEqual(['path', 'hand', 'path']);
  });
  it('choosing a mode alone changes no leg and is not in the history', () => {
    const s0 = run([add(0, 0), add(1, 1)]);
    const s = run([{ type: 'chooseMode', mode: 'hand' }], s0);
    expect(s.draft.modes).toEqual(['path']);
    expect(s.past).toHaveLength(s0.past.length);
    expect(s.nextMode).toBe('hand');
  });
  it('first point added in hand mode: still no leg, next leg is hand', () => {
    const s = run([{ type: 'chooseMode', mode: 'hand' }, add(0, 0), add(1, 1)]);
    expect(s.draft.modes).toEqual(['hand']);
  });
});

describe('move', () => {
  it('moves only the targeted point, by id', () => {
    const s0 = four();
    const s = run([{ type: 'move', id: idAt(s0, 1), lon: 0.5, lat: 0.6 }], s0);
    expect(coords(s)).toEqual([
      [0, 0],
      [0.5, 0.6],
      [0.02, 0],
      [0.03, 0],
    ]);
    expect(s.draft.modes).toEqual(s0.draft.modes);
  });
  it('unknown id changes nothing', () => {
    const s0 = four();
    const s = run([{ type: 'move', id: 9999, lon: 5, lat: 5 }], s0);
    expect(s.draft).toEqual(s0.draft);
    expect(s.past).toHaveLength(s0.past.length);
  });
  it('is one undo step', () => {
    const s0 = four();
    const s = run(
      [{ type: 'move', id: idAt(s0, 2), lon: 7, lat: 7 }, { type: 'undo' }],
      s0,
    );
    expect(s.draft).toEqual(s0.draft);
  });
});

describe('remove (C4)', () => {
  it('middle point: neighbours are joined by one leg', () => {
    const s0 = four();
    const s = run([{ type: 'remove', id: idAt(s0, 1) }], s0);
    expect(coords(s)).toEqual([
      [0, 0],
      [0.02, 0],
      [0.03, 0],
    ]);
    expect(s.draft.modes).toHaveLength(2);
    expect(listLegs(s.draft).map((l) => [l.from.lon, l.to.lon])).toEqual([
      [0, 0.02],
      [0.02, 0.03],
    ]);
  });
  it('departure removal shortens the route and drops its leg', () => {
    const s0 = run([
      add(0, 0),
      { type: 'chooseMode', mode: 'hand' },
      add(1, 0),
      { type: 'chooseMode', mode: 'path' },
      add(2, 0),
    ]);
    const s = run([{ type: 'remove', id: idAt(s0, 0) }], s0);
    expect(coords(s)).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expect(s.draft.modes).toEqual(['path']);
  });
  it('arrival removal shortens the route and drops its leg', () => {
    const s0 = run([
      add(0, 0),
      add(1, 0),
      { type: 'chooseMode', mode: 'hand' },
      add(2, 0),
    ]);
    const s = run([{ type: 'remove', id: idAt(s0, 2) }], s0);
    expect(coords(s)).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(s.draft.modes).toEqual(['path']);
  });
  const mid = (a: 'path' | 'hand', b: 'path' | 'hand') => {
    const s0 = run([
      add(0, 0),
      { type: 'chooseMode', mode: a },
      add(1, 0),
      { type: 'chooseMode', mode: b },
      add(2, 0),
    ]);
    return run([{ type: 'remove', id: idAt(s0, 1) }], s0).draft.modes;
  };
  it('middle removal: hand only if both removed legs were hand', () => {
    expect(mid('hand', 'hand')).toEqual(['hand']);
    expect(mid('hand', 'path')).toEqual(['path']);
    expect(mid('path', 'hand')).toEqual(['path']);
    expect(mid('path', 'path')).toEqual(['path']);
  });
  it('removing the only point empties the draft', () => {
    const s0 = run([add(0, 0)]);
    const s = run([{ type: 'remove', id: idAt(s0, 0) }], s0);
    expect(s.draft.points).toEqual([]);
    expect(s.draft.modes).toEqual([]);
  });
  it('removing down to 2 then 1 point keeps modes consistent', () => {
    let s = four();
    for (let i = 0; i < 3; i++) {
      s = run([{ type: 'remove', id: idAt(s, 1 % s.draft.points.length) }], s);
      expect(s.draft.modes).toHaveLength(
        Math.max(0, s.draft.points.length - 1),
      );
    }
    expect(s.draft.points).toHaveLength(1);
  });
  it('unknown id changes nothing', () => {
    const s0 = four();
    const s = run([{ type: 'remove', id: 4242 }], s0);
    expect(s.draft).toEqual(s0.draft);
    expect(s.past).toHaveLength(s0.past.length);
  });
  it('removing the chosen point clears the selection', () => {
    const s0 = four();
    const id = idAt(s0, 1);
    const s = run(
      [
        { type: 'select', id },
        { type: 'remove', id },
      ],
      s0,
    );
    expect(s.selected).toBeNull();
  });
});

describe('select', () => {
  it('chooses a point and can clear it; unknown id ignored; not in history', () => {
    const s0 = four();
    const id = idAt(s0, 2);
    const s = run([{ type: 'select', id }], s0);
    expect(s.selected).toBe(id);
    expect(s.past).toHaveLength(s0.past.length);
    expect(run([{ type: 'select', id: 777 }], s).selected).toBe(id);
    expect(run([{ type: 'select', id: null }], s).selected).toBeNull();
  });
});

describe('loop (C6)', () => {
  it('does nothing with 0 or 1 point', () => {
    const e = createDraftState();
    expect(run([{ type: 'loop' }], e).draft.points).toHaveLength(0);
    const one = run([add(0, 0)]);
    const s = run([{ type: 'loop' }], one);
    expect(s.draft).toEqual(one.draft);
    expect(s.past).toHaveLength(one.past.length);
  });
  it('adds a copy of the departure at the end, with a new id', () => {
    const s0 = run([add(1, 2), add(3, 4), add(5, 6)]);
    const s = run([{ type: 'loop' }], s0);
    expect(s.draft.points).toHaveLength(4);
    const last = s.draft.points[3]!;
    expect([last.lon, last.lat]).toEqual([1, 2]);
    expect(s0.draft.points.map((p) => p.id)).not.toContain(last.id);
    expect(s.draft.modes).toHaveLength(3);
  });
  it('the new leg takes the chosen mode', () => {
    const s = run([
      add(0, 0),
      add(1, 0),
      { type: 'chooseMode', mode: 'hand' },
      { type: 'loop' },
    ]);
    expect(s.draft.modes).toEqual(['path', 'hand']);
  });
  it('has no effect when the arrival is already on the departure', () => {
    const s0 = run([add(0, 0), add(1, 0), { type: 'loop' }]);
    const s = run([{ type: 'loop' }], s0);
    expect(s.draft).toEqual(s0.draft);
    expect(s.past).toHaveLength(s0.past.length);
  });
  it('can undo', () => {
    const s0 = run([add(0, 0), add(1, 0)]);
    expect(run([{ type: 'loop' }, { type: 'undo' }], s0).draft).toEqual(
      s0.draft,
    );
  });
  it('exposes canLoop false under 2 points, true at 2', () => {
    const { canLoop } = draftModule;
    expect(canLoop(createDraftState())).toBe(false);
    expect(canLoop(run([add(0, 0)]))).toBe(false);
    expect(canLoop(run([add(0, 0), add(1, 0)]))).toBe(true);
  });
});

describe('setLegMode', () => {
  it('changes one leg', () => {
    const s0 = four();
    const s = run([{ type: 'setLegMode', indices: [1], mode: 'hand' }], s0);
    expect(s.draft.modes).toEqual(['path', 'hand', 'path']);
  });
  it('several legs at once, undone in one step', () => {
    const s0 = four();
    const s = run([{ type: 'setLegMode', indices: [1, 2], mode: 'hand' }], s0);
    expect(s.draft.modes).toEqual(['path', 'hand', 'hand']);
    expect(s.past).toHaveLength(s0.past.length + 1);
    expect(run([{ type: 'undo' }], s).draft).toEqual(s0.draft);
  });
  it('out of range indices change nothing', () => {
    const s0 = four();
    const s = run(
      [{ type: 'setLegMode', indices: [-1, 3, 99], mode: 'hand' }],
      s0,
    );
    expect(s.draft).toEqual(s0.draft);
  });
  it('does not change nextMode', () => {
    const s = run([
      add(0, 0),
      add(1, 0),
      { type: 'setLegMode', indices: [0], mode: 'hand' },
    ]);
    expect(s.nextMode).toBe('path');
  });
});

describe('undo (C5)', () => {
  it('does nothing on an empty history', () => {
    const s0 = createDraftState();
    expect(run([{ type: 'undo' }], s0).draft).toEqual(s0.draft);
  });
  it('scenario: 4 points, move, remove 2nd, loop, mode change, undo x4', () => {
    const states: DraftState[] = [];
    let s = createDraftState();
    const step = (a: DraftAction) => {
      states.push(s);
      s = reduceDraft(s, a);
    };
    step(add(0, 0));
    step(add(0.01, 0));
    step(add(0.02, 0));
    step(add(0.03, 0));
    step({ type: 'move', id: idAt(s, 2), lon: 0.025, lat: 0.004 });
    step({ type: 'remove', id: idAt(s, 1) });
    step({ type: 'loop' });
    step({ type: 'setLegMode', indices: [0], mode: 'hand' });
    for (let i = 0; i < 4; i++) {
      const expected = states.pop()!;
      s = reduceDraft(s, { type: 'undo' });
      expect(s.draft).toEqual(expected.draft);
    }
    // 4 undos (mode, loop, remove, move): back to the 4 added points.
    expect(coords(s)).toEqual([
      [0, 0],
      [0.01, 0],
      [0.02, 0],
      [0.03, 0],
    ]);
    // And the whole way back.
    while (states.length) {
      const expected = states.pop()!;
      s = reduceDraft(s, { type: 'undo' });
      expect(s.draft).toEqual(expected.draft);
    }
    expect(s.draft.points).toEqual([]);
  });
  it('restored point keeps its id (cache key / selection stability)', () => {
    const s0 = four();
    const id = idAt(s0, 1);
    const s = run([{ type: 'remove', id }, { type: 'undo' }], s0);
    expect(s.draft.points.map((p) => p.id)).toEqual(
      s0.draft.points.map((p) => p.id),
    );
  });
  it('does not undo the next mode', () => {
    const s = run([
      add(0, 0),
      { type: 'chooseMode', mode: 'hand' },
      add(1, 0),
      { type: 'undo' },
    ]);
    expect(s.nextMode).toBe('hand');
  });
  it('does not mutate earlier states', () => {
    const s0 = four();
    const snapshot = JSON.parse(JSON.stringify(s0));
    run(
      [
        { type: 'move', id: idAt(s0, 0), lon: 9, lat: 9 },
        { type: 'remove', id: idAt(s0, 1) },
        { type: 'loop' },
        { type: 'undo' },
      ],
      s0,
    );
    expect(JSON.parse(JSON.stringify(s0))).toEqual(snapshot);
  });
  it('keeps at most 50 actions: the 51st oldest is lost', () => {
    let s = createDraftState();
    for (let i = 0; i < 60; i++) s = reduceDraft(s, add(i, 0));
    expect(s.past.length).toBeLessThanOrEqual(50);
    let undone = 0;
    while (s.past.length > 0) {
      s = reduceDraft(s, { type: 'undo' });
      undone++;
    }
    expect(undone).toBe(50);
    // 60 added, 50 undone: 10 points remain.
    expect(s.draft.points).toHaveLength(10);
  });
  it('exactly 50 actions are all undoable back to empty', () => {
    let s = createDraftState();
    for (let i = 0; i < 50; i++) s = reduceDraft(s, add(i, 0));
    for (let i = 0; i < 50; i++) s = reduceDraft(s, { type: 'undo' });
    expect(s.draft.points).toEqual([]);
  });
  it('a selected point that disappears by undo is deselected', () => {
    const s0 = run([add(0, 0), add(1, 0)]);
    const s1 = run([add(2, 0)], s0);
    const s = run([{ type: 'select', id: idAt(s1, 2) }, { type: 'undo' }], s1);
    expect(s.selected).toBeNull();
  });
});

describe('summarize (C7, C8, C10)', () => {
  const leg = (distanceKm: number, durationS: number): LegResult => ({
    distanceKm,
    durationS,
  });
  it('empty and one-point drafts sum to zero', () => {
    expect(summarize(createDraftState().draft, [])).toMatchObject({
      distanceKm: 0,
      durationS: 0,
    });
    expect(summarize(run([add(0, 0)]).draft, [])).toMatchObject({
      distanceKm: 0,
      durationS: 0,
    });
  });
  it('sums engine legs: 2.5+1.25+0.75 km, 600+300+180 s', () => {
    const r = summarize(four().draft, [
      leg(2.5, 600),
      leg(1.25, 300),
      leg(0.75, 180),
    ]);
    expect(r.distanceKm).toBeCloseTo(4.5, 9);
    expect(r.durationS).toBeCloseTo(1080, 9);
    expect(r.complete).toBe(true);
  });
  it('a path leg without result is not counted and flagged incomplete', () => {
    const r = summarize(four().draft, [leg(2, 600), undefined, leg(1, 300)]);
    expect(r.distanceKm).toBeCloseTo(3, 9);
    expect(r.durationS).toBeCloseTo(900, 9);
    expect(r.complete).toBe(false);
  });
  it('hand leg alone: straight distance, 10 km/h', () => {
    const s = run([
      { type: 'chooseMode', mode: 'hand' },
      add(0, 0),
      add(0.01, 0),
    ]);
    const r = summarize(s.draft, [undefined]);
    // 0.01 deg = 1.1119493 km ; 1.1119493 / 10 km/h = 0.11119493 h = 400.30 s
    expect(r.distanceKm).toBeCloseTo(0.01 * DEG_KM, 4);
    expect(r.durationS).toBeCloseTo(400.3, 1);
  });
  it('hand leg uses the mean speed of engine legs (12 km/h)', () => {
    // Engine legs: 1 km in 300 s and 1 km in 300 s -> 2 km / 600 s = 12 km/h.
    // Hand leg 1.1119493 km at 12 km/h = 333.585 s.
    const s = run([
      add(0, 0),
      add(0.01, 0),
      add(0.02, 0),
      { type: 'chooseMode', mode: 'hand' },
      add(0.03, 0),
    ]);
    const r = summarize(s.draft, [leg(1, 300), leg(1, 300), undefined]);
    expect(r.distanceKm).toBeCloseTo(2 + 0.01 * DEG_KM, 4);
    expect(r.durationS).toBeCloseTo(600 + 333.585, 1);
  });
  it('mean speed is weighted by distance, not an average of speeds', () => {
    // 3 km in 900 s (12 km/h) + 1 km in 600 s (6 km/h): total 4 km / 1500 s
    // = 9.6 km/h. Hand leg 1.1119493 km at 9.6 = 416.98 s.
    const s = run([
      add(0, 0),
      add(0.01, 0),
      add(0.02, 0),
      { type: 'chooseMode', mode: 'hand' },
      add(0.03, 0),
    ]);
    const r = summarize(s.draft, [leg(3, 900), leg(1, 600), undefined]);
    expect(r.durationS).toBeCloseTo(1500 + 416.98, 1);
  });
  it('hand-leg result passed by the caller is ignored', () => {
    const s = run([
      { type: 'chooseMode', mode: 'hand' },
      add(0, 0),
      add(0.01, 0),
    ]);
    const r = summarize(s.draft, [leg(50, 50)]);
    expect(r.distanceKm).toBeCloseTo(0.01 * DEG_KM, 4);
  });
  it('hand leg on a diagonal: 3 deg lat equals 333.585 km', () => {
    const d = handLeg({ id: 1, lon: 0, lat: 0 }, { id: 2, lon: 0, lat: 3 });
    expect(d.distanceKm).toBeCloseTo(3 * DEG_KM, 3);
    expect(d.durationS).toBeCloseTo((3 * DEG_KM * 3600) / 10, 0);
  });
  it('handLeg honours a given speed', () => {
    const d = handLeg(
      { id: 1, lon: 0, lat: 0 },
      { id: 2, lon: 0.01, lat: 0 },
      20,
    );
    expect(d.durationS).toBeCloseTo(200.15, 1);
  });
  it('zero-length hand leg: zero distance and duration', () => {
    const d = handLeg({ id: 1, lon: 1, lat: 1 }, { id: 2, lon: 1, lat: 1 });
    expect(d.distanceKm).toBe(0);
    expect(d.durationS).toBe(0);
  });
  it('minimum duration displays "1 min" (0 s and 20 s)', () => {
    expect(formatDuration(0)).toBe('1 min');
    const r = summarize(run([add(0, 0), add(0.0001, 0)]).draft, [
      leg(0.01, 20),
    ]);
    expect(formatDuration(r.durationS)).toBe('1 min');
    expect(
      formatDuration(summarize(createDraftState().draft, []).durationS),
    ).toBe('1 min');
  });
  it('summary follows each action (scenario)', () => {
    const s0 = four();
    const results = [leg(1, 300), leg(1, 300), leg(1, 300)];
    expect(summarize(s0.draft, results).distanceKm).toBeCloseTo(3, 9);
    // remove last point: leg 2 disappears
    const s1 = run([{ type: 'remove', id: idAt(s0, 3) }], s0);
    expect(summarize(s1.draft, results).distanceKm).toBeCloseTo(2, 9);
    // undo restores 3 km
    const s2 = run([{ type: 'undo' }], s1);
    expect(summarize(s2.draft, results).distanceKm).toBeCloseTo(3, 9);
    // switch last leg to hand: replaced by straight 1.1119 km at 12 km/h
    const s3 = run([{ type: 'setLegMode', indices: [2], mode: 'hand' }], s2);
    const r = summarize(s3.draft, results);
    expect(r.distanceKm).toBeCloseTo(2 + 0.01 * DEG_KM, 4);
    expect(r.durationS).toBeCloseTo(600 + 333.585, 1);
  });
});

describe('listLegs', () => {
  it('lists legs in order with their modes', () => {
    const s = run([
      add(0, 0),
      add(1, 0),
      { type: 'chooseMode', mode: 'hand' },
      add(2, 0),
    ]);
    const legs = listLegs(s.draft);
    expect(legs.map((l) => [l.index, l.mode])).toEqual([
      [0, 'path'],
      [1, 'hand'],
    ]);
    expect(legs[1]!.from.lon).toBe(1);
    expect(legs[1]!.to.lon).toBe(2);
  });
  it('is empty under 2 points', () => {
    expect(listLegs(createDraftState().draft)).toEqual([]);
    expect(listLegs(run([add(0, 0)]).draft)).toEqual([]);
  });
});
