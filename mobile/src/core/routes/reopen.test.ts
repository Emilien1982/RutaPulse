import { legKey, reopenDraft } from './reopen';
import type { CreatedRoute } from './savedRoute';
import { sampleCreated } from './testing/sampleRoutes';

const route = { ...sampleCreated(), id: 7, readable: true } as CreatedRoute;

describe('reopenDraft', () => {
  it('starts from the saved draft with an empty history', () => {
    const { state } = reopenDraft(route);
    expect(state.draft).toBe(route.draft);
    expect(state.past).toEqual([]);
    expect(state.nextMode).toBe('path');
    expect(state.selected).toBeNull();
    expect(state.nextId).toBe(4);
  });

  it('keeps the computed legs by their two ends, with their zone version', () => {
    const { kept } = reopenDraft(route);
    const [a, b] = route.draft.points;
    expect([...kept.keys()]).toEqual([legKey(a, b)]);
    expect(kept.get(legKey(a, b))).toMatchObject({
      ok: true,
      zoneVersion: 5,
      distanceKm: 1.234,
      durationS: 300,
    });
  });

  it('a hand leg is not kept', () => {
    expect(reopenDraft(route).kept.size).toBe(1);
  });
});
