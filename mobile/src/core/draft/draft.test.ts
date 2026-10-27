import {
  canLoop,
  canUndo,
  createDraftState,
  MAX_HISTORY,
  reduceDraft,
  type DraftAction,
  type DraftState,
  type LegMode,
} from './draft';

function run(actions: DraftAction[], from = createDraftState()): DraftState {
  return actions.reduce(reduceDraft, from);
}

function add(n: number): DraftAction[] {
  return Array.from({ length: n }, (_, i) => ({
    type: 'add' as const,
    lon: 6 + i * 0.01,
    lat: 48,
  }));
}

/** A route whose legs have the given modes (point ids 1, 2, ...). */
function build(modes: LegMode[]): DraftState {
  let s = run(add(1));
  for (const mode of modes) {
    s = reduceDraft(s, { type: 'chooseMode', mode });
    s = reduceDraft(s, { type: 'add', lon: 6 + s.nextId * 0.01, lat: 48 });
  }
  return s;
}

const ids = (s: DraftState) => s.draft.points.map((p) => p.id);

describe('add', () => {
  it('puts the point at the end with a fresh id', () => {
    const s = run(add(3));
    expect(ids(s)).toEqual([1, 2, 3]);
    expect(s.draft.modes).toEqual(['path', 'path']);
  });

  it('gives the first point no leg', () => {
    expect(run(add(1)).draft.modes).toEqual([]);
  });

  it('gives the new leg nextMode', () => {
    const s = run([
      ...add(1),
      { type: 'chooseMode', mode: 'hand' },
      ...add(1),
      { type: 'chooseMode', mode: 'path' },
      ...add(1),
    ]);
    expect(s.draft.modes).toEqual(['hand', 'path']);
  });
});

describe('move', () => {
  it('changes only the position of that point', () => {
    const s = reduceDraft(run(add(3)), {
      type: 'move',
      id: 2,
      lon: 7,
      lat: 49,
    });
    expect(s.draft.points[1]).toEqual({ id: 2, lon: 7, lat: 49 });
    expect(s.draft.points[0]?.lon).toBe(6);
    expect(s.past).toHaveLength(4);
  });

  it('does nothing for an unknown id or the same position', () => {
    const s = run(add(2));
    expect(reduceDraft(s, { type: 'move', id: 9, lon: 1, lat: 1 })).toBe(s);
    expect(reduceDraft(s, { type: 'move', id: 1, lon: 6, lat: 48 })).toBe(s);
  });
});

describe('remove', () => {
  it('removes the departure and its leg', () => {
    const s = reduceDraft(build(['hand', 'path']), { type: 'remove', id: 1 });
    expect(ids(s)).toEqual([2, 3]);
    expect(s.draft.modes).toEqual(['path']);
  });

  it('removes the arrival and its leg', () => {
    const s = reduceDraft(build(['hand', 'path']), { type: 'remove', id: 3 });
    expect(ids(s)).toEqual([1, 2]);
    expect(s.draft.modes).toEqual(['hand']);
  });

  it.each([
    ['hand', 'hand', 'hand'],
    ['hand', 'path', 'path'],
    ['path', 'hand', 'path'],
    ['path', 'path', 'path'],
  ] as const)(
    'middle point with legs %s + %s joins its neighbours %s',
    (m1, m2, expected) => {
      const s = reduceDraft(build([m1, m2]), { type: 'remove', id: 2 });
      expect(ids(s)).toEqual([1, 3]);
      expect(s.draft.modes).toEqual([expected]);
    },
  );

  it('keeps the other legs when removing in a longer route', () => {
    const s = reduceDraft(build(['path', 'hand', 'hand', 'path']), {
      type: 'remove',
      id: 3,
    });
    expect(ids(s)).toEqual([1, 2, 4, 5]);
    expect(s.draft.modes).toEqual(['path', 'hand', 'path']);
  });

  it('empties the route when the last point goes', () => {
    const s = reduceDraft(run(add(1)), { type: 'remove', id: 1 });
    expect(s.draft).toEqual({ points: [], modes: [] });
  });

  it('does nothing for an unknown id', () => {
    const s = run(add(2));
    expect(reduceDraft(s, { type: 'remove', id: 9 })).toBe(s);
  });
});

describe('loop', () => {
  it('copies the departure at the end with a new id and nextMode', () => {
    const s = run([
      ...add(3),
      { type: 'chooseMode', mode: 'hand' },
      { type: 'loop' },
    ]);
    expect(ids(s)).toEqual([1, 2, 3, 4]);
    const [first, , , last] = s.draft.points;
    expect(last).toEqual({ id: 4, lon: first?.lon, lat: first?.lat });
    expect(s.draft.modes).toEqual(['path', 'path', 'hand']);
  });

  it.each([0, 1])('does nothing with %i point(s)', (n) => {
    const s = run(add(n));
    expect(reduceDraft(s, { type: 'loop' })).toBe(s);
    expect(canLoop(s)).toBe(false);
  });

  it('is possible from 2 points', () => {
    const s = run(add(2));
    expect(canLoop(s)).toBe(true);
    expect(reduceDraft(s, { type: 'loop' }).draft.points).toHaveLength(3);
  });

  it('is undone in one step', () => {
    const before = run(add(3));
    const s = run([{ type: 'loop' }, { type: 'undo' }], before);
    expect(s.draft).toEqual(before.draft);
  });
});

describe('setLegMode', () => {
  it('changes one leg', () => {
    const s = reduceDraft(run(add(3)), {
      type: 'setLegMode',
      indices: [1],
      mode: 'hand',
    });
    expect(s.draft.modes).toEqual(['path', 'hand']);
  });

  it.each([-1, 2, 0.5])('ignores index %s', (index) => {
    const s = run(add(3));
    expect(
      reduceDraft(s, { type: 'setLegMode', indices: [index], mode: 'hand' }),
    ).toBe(s);
  });

  it('ignores the mode the leg already has', () => {
    const s = run(add(3));
    expect(
      reduceDraft(s, { type: 'setLegMode', indices: [0], mode: 'path' }),
    ).toBe(s);
  });
});

describe('setLegMode with several legs', () => {
  it('changes them in one history entry, undone at once', () => {
    const s = run(add(4));
    const t = reduceDraft(s, {
      type: 'setLegMode',
      indices: [0, 2, 7, -1],
      mode: 'hand',
    });
    expect(t.draft.modes).toEqual(['hand', 'path', 'hand']);
    expect(t.past).toHaveLength(s.past.length + 1);
    expect(reduceDraft(t, { type: 'undo' }).draft).toEqual(s.draft);
  });

  it('does nothing when no leg changes', () => {
    const s = run(add(3));
    expect(
      reduceDraft(s, { type: 'setLegMode', indices: [], mode: 'hand' }),
    ).toBe(s);
    expect(
      reduceDraft(s, { type: 'setLegMode', indices: [0, 1], mode: 'path' }),
    ).toBe(s);
  });
});

describe('loop twice and remove the departure', () => {
  it('is refused when the last point is already at the departure', () => {
    const once = run([...add(3), { type: 'loop' }]);
    expect(canLoop(once)).toBe(false);
    expect(reduceDraft(once, { type: 'loop' })).toBe(once);
  });

  it('can loop again once the closing point is moved', () => {
    const s = run([
      ...add(3),
      { type: 'loop' },
      { type: 'move', id: 4, lon: 9, lat: 9 },
    ]);
    expect(canLoop(s)).toBe(true);
  });

  it('loop then remove the departure keeps the closing point', () => {
    const s = run([...add(3), { type: 'loop' }, { type: 'remove', id: 1 }]);
    expect(ids(s)).toEqual([2, 3, 4]);
    expect(s.draft.modes).toEqual(['path', 'path']);
  });
});

describe('undo', () => {
  it('goes back to the very beginning, one action at a time', () => {
    const states = [createDraftState()];
    const actions: DraftAction[] = [
      ...add(3),
      { type: 'move', id: 2, lon: 9, lat: 9 },
      { type: 'setLegMode', indices: [0], mode: 'hand' },
      { type: 'loop' },
      { type: 'remove', id: 2 },
    ];
    for (const a of actions) {
      states.push(reduceDraft(states[states.length - 1]!, a));
    }
    let s = states[states.length - 1]!;
    for (let i = states.length - 2; i >= 0; i--) {
      s = reduceDraft(s, { type: 'undo' });
      expect(s.draft).toEqual(states[i]?.draft);
    }
    expect(canUndo(s)).toBe(false);
    expect(reduceDraft(s, { type: 'undo' })).toBe(s);
  });

  it('keeps 50 actions at most, the oldest goes', () => {
    let s = run(add(60));
    expect(s.past).toHaveLength(MAX_HISTORY);
    for (let i = 0; i < 100; i++) s = reduceDraft(s, { type: 'undo' });
    expect(s.draft.points).toHaveLength(10);
    expect(canUndo(s)).toBe(false);
  });

  it('does not reuse ids after an undo', () => {
    const s = run([...add(2), { type: 'undo' }, ...add(1)]);
    expect(ids(s)).toEqual([1, 3]);
  });

  it('does not touch nextMode', () => {
    const s = run([
      ...add(1),
      { type: 'chooseMode', mode: 'hand' },
      { type: 'undo' },
    ]);
    expect(s.nextMode).toBe('hand');
  });
});

describe('chooseMode and select (outside the history)', () => {
  it('chooseMode adds nothing to the history', () => {
    const s = run(add(1));
    const t = reduceDraft(s, { type: 'chooseMode', mode: 'hand' });
    expect(t.nextMode).toBe('hand');
    expect(t.past).toBe(s.past);
    expect(reduceDraft(t, { type: 'chooseMode', mode: 'hand' })).toBe(t);
  });

  it('select adds nothing to the history and ignores unknown ids', () => {
    const s = run(add(2));
    const t = reduceDraft(s, { type: 'select', id: 2 });
    expect(t.selected).toBe(2);
    expect(t.past).toBe(s.past);
    expect(reduceDraft(t, { type: 'select', id: 2 })).toBe(t);
    expect(reduceDraft(t, { type: 'select', id: 99 })).toBe(t);
    expect(reduceDraft(t, { type: 'select', id: null }).selected).toBeNull();
  });
});

describe('chosen point stays coherent', () => {
  it('is cleared when that point is removed', () => {
    const s = run([
      ...add(3),
      { type: 'select', id: 2 },
      { type: 'remove', id: 2 },
    ]);
    expect(s.selected).toBeNull();
  });

  it('stays when another point is removed', () => {
    const s = run([
      ...add(3),
      { type: 'select', id: 3 },
      { type: 'remove', id: 1 },
    ]);
    expect(s.selected).toBe(3);
  });

  it('is cleared when undo removes that point', () => {
    const s = run([...add(2), { type: 'select', id: 2 }, { type: 'undo' }]);
    expect(s.selected).toBeNull();
  });

  it('is kept when undo brings back a removed point other than it', () => {
    const s = run([
      ...add(3),
      { type: 'remove', id: 1 },
      { type: 'select', id: 3 },
      { type: 'undo' },
    ]);
    expect(s.selected).toBe(3);
    expect(ids(s)).toEqual([1, 2, 3]);
  });
});

describe('immutability and no-effect actions', () => {
  it('never modifies the state it receives', () => {
    const s = build(['hand', 'path', 'path']);
    const snapshot = JSON.parse(JSON.stringify(s)) as DraftState;
    const actions: DraftAction[] = [
      { type: 'add', lon: 1, lat: 1 },
      { type: 'move', id: 2, lon: 1, lat: 1 },
      { type: 'remove', id: 2 },
      { type: 'loop' },
      { type: 'setLegMode', indices: [0], mode: 'path' },
      { type: 'undo' },
      { type: 'chooseMode', mode: 'hand' },
      { type: 'select', id: 1 },
    ];
    Object.freeze(s.draft.points);
    Object.freeze(s.draft.modes);
    Object.freeze(s.past);
    Object.freeze(s.draft);
    Object.freeze(s);
    for (const a of actions) reduceDraft(s, a);
    expect(JSON.parse(JSON.stringify(s))).toEqual(snapshot);
  });

  it('keeps the previous draft untouched and puts it in the history', () => {
    const s = run(add(2));
    const t = reduceDraft(s, { type: 'move', id: 1, lon: 1, lat: 1 });
    expect(s.draft.points[0]?.lon).toBe(6);
    expect(t.past[t.past.length - 1]).toBe(s.draft);
  });
});
