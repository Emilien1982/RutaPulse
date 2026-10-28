// Altitude profile of the whole route (ADR 0017, section 4).

import type { ProfilePoint } from '../routing/infoResponse';

/** Length of one profile (m): its last distance. */
export function profileLength(profile: ProfilePoint[]): number {
  return profile[profile.length - 1]?.[0] ?? 0;
}

/**
 * Puts the leg profiles end to end. The distances of a leg are shifted by
 * the length of the profiles before it. All points are kept.
 */
export function joinProfiles(profiles: ProfilePoint[][]): ProfilePoint[] {
  const joined: ProfilePoint[] = [];
  let offset = 0;
  for (const profile of profiles) {
    for (const [distance, height] of profile) {
      joined.push([offset + distance, height]);
    }
    offset += profileLength(profile);
  }
  return joined;
}

/** Altitudes of a profile, or null when one is missing (all or nothing). */
export function heightsOf(profile: ProfilePoint[]): number[] | null {
  const heights: number[] = [];
  for (const [, height] of profile) {
    if (height === null) return null;
    heights.push(height);
  }
  return heights.length > 0 ? heights : null;
}

/** Lowest and highest altitude (m), or null when empty or incomplete. */
export function elevationRange(
  profile: ProfilePoint[],
): { minM: number; maxM: number } | null {
  const heights = heightsOf(profile);
  if (!heights) return null;
  return { minM: Math.min(...heights), maxM: Math.max(...heights) };
}
