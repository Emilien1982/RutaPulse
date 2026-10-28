// Legs of a draft: what to compute, and the sum shown on the sheet
// (ADR 0016, sections 1 and 3).

import { distanceMeters } from '../routing/routeLink';
import type { Draft, DraftPoint, LegMode } from './draft';

/** Distance and duration of one leg, as given by the engine. */
export type LegResult = { distanceKm: number; durationS: number };

export type Leg = {
  /** Index in `draft.modes`. */
  index: number;
  from: DraftPoint;
  to: DraftPoint;
  mode: LegMode;
};

/** Speed used for "by hand" legs when no leg was computed (km/h). */
export const HAND_SPEED_KMH = 10;

/** All legs of the draft, in order. The caller computes the 'path' ones. */
export function listLegs(draft: Draft): Leg[] {
  return draft.modes.flatMap((mode, index) => {
    const from = draft.points[index];
    const to = draft.points[index + 1];
    return from && to ? [{ index, from, to, mode }] : [];
  });
}

/** A "by hand" leg: straight line, duration at the given speed. */
export function handLeg(
  from: DraftPoint,
  to: DraftPoint,
  speedKmh: number = HAND_SPEED_KMH,
): LegResult {
  const distanceKm = distanceMeters(from, to) / 1000;
  return { distanceKm, durationS: (distanceKm / speedKmh) * 3600 };
}

export type DraftSummary = {
  distanceKm: number;
  durationS: number;
  /** False when a 'path' leg has no result yet: it is not counted. */
  complete: boolean;
};

/**
 * Sum of the legs. `results[i]` is the engine result of leg i (ignored for
 * a 'hand' leg). The dotted link to the path is never counted.
 */
export function summarize(
  draft: Draft,
  results: (LegResult | undefined)[],
): DraftSummary {
  let distanceKm = 0;
  let durationS = 0;
  let engineKm = 0;
  let engineS = 0;
  let complete = true;
  const handLegs: Leg[] = [];
  for (const leg of listLegs(draft)) {
    if (leg.mode === 'hand') {
      handLegs.push(leg);
      continue;
    }
    const result = results[leg.index];
    if (!result) {
      complete = false;
      continue;
    }
    engineKm += result.distanceKm;
    engineS += result.durationS;
  }
  distanceKm += engineKm;
  durationS += engineS;
  const speedKmh =
    engineKm > 0 && engineS > 0 ? engineKm / (engineS / 3600) : HAND_SPEED_KMH;
  for (const leg of handLegs) {
    const hand = handLeg(leg.from, leg.to, speedKmh);
    distanceKm += hand.distanceKm;
    durationS += hand.durationS;
  }
  return { distanceKm, durationS, complete };
}
