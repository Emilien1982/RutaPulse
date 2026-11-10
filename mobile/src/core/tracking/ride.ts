// The real figures of the ride (ADR 0021, section 4): positions kept, real
// distance, duration, and the request for the real ascent. Pure logic.

import type { HeightResult } from '@/core/routing/infoResponse';
import { buildHeightRequest } from '@/core/routing/infoRequest';
import { ascentDescent } from '@/core/route-info/elevation';
import { heightsOf } from '@/core/route-info/profile';
import type { LonLat } from '@/core/routes/savedRoute';
import { MAX_ENGINE_POINTS, thinTrack, trackInside } from '@/core/routes/track';
import type { Bbox } from '@/core/zones/catalogue';

import { MAX_ACCURACY_M, type Fix } from './placement';
import { distanceM } from './trackingLine';

/** A position is kept when it is at least this far (m) from the last one kept. */
export const KEEP_STEP_M = 10;

export type Ride = {
  /** Positions kept. */
  kept: LonLat[];
  /** Real distance (m): the sum of the distances between positions kept. */
  distanceM: number;
  /** ms. */
  startedAt: number;
};

export function startRide(startedAt: number): Ride {
  return { kept: [], distanceM: 0, startedAt };
}

/**
 * Keeps a position when it is 10 m or more from the last one kept, so the
 * noise at a standstill adds nothing. After a pause with the GPS off, the
 * jump from the last position before to the first after counts in a straight
 * line, as the jump between two segments of a GPX does (ADR 0019).
 */
export function addRideFix(ride: Ride, fix: Fix): Ride {
  if (fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_M) return ride;
  const here: LonLat = [fix.lon, fix.lat];
  const last = ride.kept[ride.kept.length - 1];
  if (!last) return { ...ride, kept: [here] };
  const step = distanceM(last, here);
  if (step < KEEP_STEP_M) return ride;
  return {
    ...ride,
    kept: [...ride.kept, here],
    distanceM: ride.distanceM + step,
  };
}

/** Duration in seconds, from the start to the end by the clock: pauses count. */
export function rideDurationS(ride: Ride, endedAt: number): number {
  return Math.max(0, Math.round((endedAt - ride.startedAt) / 1000));
}

/**
 * The shape to give to `height` for the real ascent: the positions kept,
 * thinned to 14 000 points. Null when there is nothing to measure, when the
 * zone is not in service, or when a position is outside the zone (no
 * altitude: "—").
 */
export function rideHeightShape(
  ride: Ride,
  bbox: Bbox | null,
): LonLat[] | null {
  if (!bbox || ride.kept.length < 2 || !trackInside(bbox, ride.kept)) {
    return null;
  }
  return thinTrack(ride.kept, MAX_ENGINE_POINTS);
}

/** JSON text of the `height` request for the shape above (one altitude every 30 m). */
export function buildRideHeightRequest(
  ride: Ride,
  bbox: Bbox | null,
): string | null {
  const shape = rideHeightShape(ride, bbox);
  return shape ? buildHeightRequest(shape) : null;
}

/** Real ascent (m) from the answer of `height`; null on failure or a missing altitude. */
export function rideAscentM(result: HeightResult): number | null {
  if (!result.ok) return null;
  const heights = heightsOf(result.profile);
  return heights ? ascentDescent(heights).ascentM : null;
}
