// The route being created: points, one mode per leg, and an undo history
// (ADR 0016, section 1). Pure logic, no React, no map, no engine.

/** 'path' = along the paths (engine), 'hand' = straight line. */
export type LegMode = 'path' | 'hand';

export type DraftPoint = { id: number; lon: number; lat: number };

/** modes[i] is the leg from points[i] to points[i + 1]. */
export type Draft = { points: DraftPoint[]; modes: LegMode[] };

export type DraftState = {
  draft: Draft;
  /** Oldest first, at most MAX_HISTORY. Results of calculations are not kept. */
  past: Draft[];
  /** Mode given to the next leg added. Not in the history. */
  nextMode: LegMode;
  /** Id (not index) of the chosen point. Not in the history. */
  selected: number | null;
  nextId: number;
};

export type DraftAction =
  | { type: 'add'; lon: number; lat: number }
  | { type: 'move'; id: number; lon: number; lat: number }
  | { type: 'remove'; id: number }
  | { type: 'loop' }
  | { type: 'setLegMode'; indices: number[]; mode: LegMode }
  | { type: 'undo' }
  | { type: 'chooseMode'; mode: LegMode }
  | { type: 'select'; id: number | null };

export const MAX_HISTORY = 50;

export function createDraftState(): DraftState {
  return {
    draft: { points: [], modes: [] },
    past: [],
    nextMode: 'path',
    selected: null,
    nextId: 1,
  };
}

/** Same state plus a new draft, the old one pushed to the history. */
function commit(
  state: DraftState,
  draft: Draft,
  extra: Partial<DraftState> = {},
): DraftState {
  const past = [...state.past, state.draft].slice(-MAX_HISTORY);
  return { ...state, ...extra, draft, past };
}

function removePoint(draft: Draft, index: number): Draft {
  const { points, modes } = draft;
  const newPoints = points.filter((_, i) => i !== index);
  if (points.length === 1) return { points: newPoints, modes: [] };
  if (index === 0) return { points: newPoints, modes: modes.slice(1) };
  if (index === points.length - 1) {
    return { points: newPoints, modes: modes.slice(0, -1) };
  }
  // Middle: the neighbours are joined. "By hand" only if both legs were.
  const joined: LegMode =
    modes[index - 1] === 'hand' && modes[index] === 'hand' ? 'hand' : 'path';
  return {
    points: newPoints,
    modes: [...modes.slice(0, index - 1), joined, ...modes.slice(index + 1)],
  };
}

export function reduceDraft(
  state: DraftState,
  action: DraftAction,
): DraftState {
  const { draft } = state;
  switch (action.type) {
    case 'add': {
      const point = { id: state.nextId, lon: action.lon, lat: action.lat };
      const modes =
        draft.points.length === 0
          ? draft.modes
          : [...draft.modes, state.nextMode];
      return commit(
        state,
        { points: [...draft.points, point], modes },
        { nextId: state.nextId + 1 },
      );
    }
    case 'move': {
      const index = draft.points.findIndex((p) => p.id === action.id);
      const old = draft.points[index];
      if (!old || (old.lon === action.lon && old.lat === action.lat)) {
        return state;
      }
      const points = draft.points.map((p, i) =>
        i === index ? { id: p.id, lon: action.lon, lat: action.lat } : p,
      );
      return commit(state, { points, modes: draft.modes });
    }
    case 'remove': {
      const index = draft.points.findIndex((p) => p.id === action.id);
      if (index < 0) return state;
      return commit(state, removePoint(draft, index), {
        selected: state.selected === action.id ? null : state.selected,
      });
    }
    case 'loop': {
      const first = draft.points[0];
      if (!first || !canLoop(state)) return state;
      const copy = { id: state.nextId, lon: first.lon, lat: first.lat };
      return commit(
        state,
        {
          points: [...draft.points, copy],
          modes: [...draft.modes, state.nextMode],
        },
        { nextId: state.nextId + 1 },
      );
    }
    case 'setLegMode': {
      // One action for all the legs: one history entry. Bad indices ignored.
      const changed = new Set(
        action.indices.filter(
          (i) =>
            Number.isInteger(i) &&
            i >= 0 &&
            i < draft.modes.length &&
            draft.modes[i] !== action.mode,
        ),
      );
      if (changed.size === 0) return state;
      const modes = draft.modes.map((m, i) =>
        changed.has(i) ? action.mode : m,
      );
      return commit(state, { points: draft.points, modes });
    }
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      const stillThere = previous.points.some((p) => p.id === state.selected);
      return {
        ...state,
        draft: previous,
        past: state.past.slice(0, -1),
        selected: stillThere ? state.selected : null,
      };
    }
    case 'chooseMode':
      return action.mode === state.nextMode
        ? state
        : { ...state, nextMode: action.mode };
    case 'select': {
      if (action.id === state.selected) return state;
      if (action.id !== null && !draft.points.some((p) => p.id === action.id)) {
        return state;
      }
      return { ...state, selected: action.id };
    }
  }
}

/**
 * "Boucler" needs at least 2 points, and a last point that is not already
 * at the departure (it would add a leg of length zero).
 */
export function canLoop(state: DraftState): boolean {
  const { points } = state.draft;
  const first = points[0];
  const last = points[points.length - 1];
  return (
    points.length >= 2 &&
    !!first &&
    !!last &&
    (first.lon !== last.lon || first.lat !== last.lat)
  );
}

/** "Annuler" needs something in the history. */
export function canUndo(state: DraftState): boolean {
  return state.past.length > 0;
}
