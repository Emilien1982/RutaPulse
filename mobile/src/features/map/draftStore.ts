// Store of the creation screen: TanStack Store around `reduceDraft`
// (ADR 0016, section 2). Every change goes through the reducer.

import { createStore } from '@tanstack/react-store';

import {
  createDraftState,
  reduceDraft,
  type DraftAction,
  type DraftState,
} from '@/core/draft/draft';

export function createDraftStore() {
  const store = createStore<DraftState>(createDraftState());
  return {
    store,
    dispatch(action: DraftAction): void {
      store.setState((state) => reduceDraft(state, action));
    },
  };
}
