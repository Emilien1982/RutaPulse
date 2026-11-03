// The saved route that "Modifier" sends to the creation. Kept here rather
// than in a route parameter: expo-router may put the parameters of a nested
// stack only on its deepest screen, and a lost `routeId` would open an empty
// creation that saves a new route. Set just before the push, read once when
// the creation opens, cleared when it closes.

let target: number | null = null;

export function setDraftTarget(routeId: number | null): void {
  target = routeId;
}

export function peekDraftTarget(): number | null {
  return target;
}
