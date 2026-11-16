// Distance and ascent left to ride (ADR 0021, section 4). The altitudes are
// those of the Infos screen: no new call to the engine.

import type { ProfilePoint } from '@/core/routing/infoResponse';
import { ELEVATION_THRESHOLD_M } from '@/core/route-info/elevation';
import { heightsOf, profileLength } from '@/core/route-info/profile';

import type { Placement } from './placement';
import type { TrackingLine } from './trackingLine';

/** Distance left to ride (m): after the target when off the track, all of it before the start. */
export function remainingM(line: TrackingLine, placement: Placement): number {
  return Math.max(0, line.lengthM - referenceM(placement));
}

/** Where the rider counts from: the placement, or the target when off the track. */
function referenceM(placement: Placement): number {
  if (placement.phase === 'offTrack') {
    return placement.targetM ?? placement.progressM;
  }
  return placement.phase === 'onTrack' ? placement.progressM : 0;
}

/** The ascent counted along the profile, point by point. */
export type ClimbProfile = {
  /** Distance of each point of the profile (m). */
  distancesM: number[];
  /** Ascent counted up to each point (m). */
  climbAt: number[];
  totalM: number;
  lengthM: number;
};

/**
 * Ascent up to each point of the profile, with the method of the Infos screen
 * (a change under 5 m is noise). Null when an altitude is missing: all or
 * nothing (ADR 0017).
 */
export function climbProfile(profile: ProfilePoint[]): ClimbProfile | null {
  const heights = heightsOf(profile);
  if (!heights) return null;
  let ref = heights[0] as number;
  let total = 0;
  const climbAt = [0];
  for (let i = 1; i < heights.length; i++) {
    const h = heights[i] as number;
    if (h - ref >= ELEVATION_THRESHOLD_M) {
      total += h - ref;
      ref = h;
    } else if (ref - h >= ELEVATION_THRESHOLD_M) {
      ref = h;
    }
    climbAt.push(total);
  }
  return {
    distancesM: profile.map(([distance]) => distance),
    climbAt,
    totalM: total,
    lengthM: profileLength(profile),
  };
}

/**
 * Ascent left (m), or null without altitudes. The axis of the profile and the
 * axis of the line differ by a few meters: one is put on the other by the
 * proportion of their lengths. Starts at the total, never goes up, ends at 0.
 */
export function remainingClimbM(
  climb: ClimbProfile | null,
  line: TrackingLine,
  placement: Placement,
): number | null {
  if (!climb) return null;
  const share = line.lengthM > 0 ? referenceM(placement) / line.lengthM : 0;
  const at = Math.min(1, Math.max(0, share)) * climb.lengthM;
  // Last point of the profile at or before `at`.
  let lo = 0;
  let hi = climb.distancesM.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((climb.distancesM[mid] as number) <= at) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, climb.totalM - (climb.climbAt[lo] as number));
}
