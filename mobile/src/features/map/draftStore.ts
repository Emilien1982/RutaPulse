// Store of the creation screen: TanStack Store around `reduceDraft`
// (ADR 0016, section 2). Every change goes through the reducer.

import { createStore } from '@tanstack/react-store';

import {
  createDraftState,
  reduceDraft,
  type Draft,
  type DraftAction,
  type DraftState,
} from '@/core/draft/draft';

/** What is written in the database (ADR 0019, section 4, point 5). */
export type SavedInfo = {
  /** null until the first "Enregistrer" of a new route. */
  routeId: number | null;
  /** The draft of the last save; the session has changes if it differs. */
  savedDraft: Draft | null;
};

export function createDraftStore(
  initial: DraftState = createDraftState(),
  saved: SavedInfo = { routeId: null, savedDraft: null },
) {
  const store = createStore<DraftState>(initial);
  const savedStore = createStore<SavedInfo>(saved);
  return {
    store,
    savedStore,
    dispatch(action: DraftAction): void {
      store.setState((state) => reduceDraft(state, action));
    },
  };
}
