// A created route reopened in the creation (ADR 0019, section 4).

import { createDraftState, type DraftState } from '@/core/draft/draft';
import type { RouteSuccess } from '@/core/routing/routeResponse';

import type { CreatedRoute } from './savedRoute';

/** A computed leg kept as it was saved. */
export type KeptLeg = RouteSuccess & { zoneVersion: number };
/** Keyed by `legKey(from, to)`. */
export type KeptLegs = ReadonlyMap<string, KeptLeg>;

/** The coordinates of the two ends: a leg is "the same" if they are. */
export function legKey(
  from: { lon: number; lat: number },
  to: { lon: number; lat: number },
): string {
  return `${from.lon},${from.lat}>${to.lon},${to.lat}`;
}

export function reopenDraft(route: CreatedRoute): {
  state: DraftState;
  kept: KeptLegs;
} {
  const { draft } = route;
  const kept = new Map<string, KeptLeg>();
  route.legs.forEach((leg, i) => {
    if (leg.mode !== 'path') return;
    const key = legKey(draft.points[i], draft.points[i + 1]);
    if (kept.has(key)) return;
    kept.set(key, {
      ok: true,
      shape: leg.shape,
      distanceKm: leg.distanceKm,
      durationS: leg.durationS,
      zoneVersion: leg.zoneVersion,
    });
  });
  const nextId = Math.max(0, ...draft.points.map((p) => p.id)) + 1;
  return { state: { ...createDraftState(), draft, nextId }, kept };
}
