// What the full-screen creation starts from: a saved route ("Modifier") or a
// waymarked circuit ("En faire un itinéraire", ADR 0020, section 10). Kept
// here rather than in a route parameter: expo-router may put the parameters
// of a nested stack only on its deepest screen, and a lost target would open
// an empty creation that saves a new route. Set just before the push, read
// once when the creation opens, and cleared at once, when it opens.

export type TrailTarget = {
  kind: 'trail';
  osmId: number;
  /** Last known position of the user, or null. */
  position: { lon: number; lat: number } | null;
};

export type DraftTarget =
  { kind: 'route'; id: number } | { kind: 'gpx'; id: number } | TrailTarget;

let target: DraftTarget | null = null;

export function setDraftTarget(next: DraftTarget | null): void {
  target = next;
}

/** What the creation starts from, or null for an empty creation. */
export function peekDraftTarget(): DraftTarget | null {
  return target;
}
