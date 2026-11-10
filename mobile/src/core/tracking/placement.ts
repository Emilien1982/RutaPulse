// Placement of the GPS position on the line, with the progress already made
// (ADR 0021, section 2.3). Pure logic: one fix in, one placement out.

import type { LonLat } from '@/core/routes/savedRoute';

import {
  bestInWindow,
  nearestOnLine,
  passagesNear,
  type Nearest,
} from './nearest';
import {
  angleDiff,
  bearingBetween,
  distanceM,
  type TrackingLine,
} from './trackingLine';

/** A position with a precision worse than this (m) is ignored. */
export const MAX_ACCURACY_M = 50;
/** Farther than this (m) from the line, the rider is off the track. */
export const OFF_TRACK_M = 30;
/** Closer than this (m), the rider is back on the track. */
export const BACK_ON_TRACK_M = 20;
/** Positions in a row without a point of the line to be off the track. */
export const OFF_TRACK_FIXES = 2;
export const WINDOW_BACK_M = 50;
export const WINDOW_AHEAD_M = 500;
/** 54 km/h: a fast descent (m/s). */
export const MAX_SPEED_MS = 15;
export const TARGET_AHEAD_M = 2000;
/** Positions in a row off the track, with nothing in the window, before a search on the whole line. */
export const RELOCATE_FIXES = 5;
/** The line is found again within this distance (m). */
export const FIND_M = 20;
/** A movement of at least this (m) gives a heading. */
export const HEADING_STEP_M = 10;
/** The line is followed in the heading when it differs by 90 degrees at most. */
export const HEADING_TOLERANCE = 90;
/** Arrival: this close (m) to the last point of the line... */
export const ARRIVAL_M = 30;
/** ... after this share of the line. */
export const ARRIVAL_SHARE = 0.9;

/** A GPS position. `at` is in ms; `accuracy` is null when the phone gives none. */
export type Fix = {
  lon: number;
  lat: number;
  accuracy: number | null;
  at: number;
};

export type PlacementPhase = 'approach' | 'onTrack' | 'offTrack';

export type Placement = {
  phase: PlacementPhase;
  /** Last placement on the line (m). 0 before the track is reached. */
  progressM: number;
  /** Time of the last placement (ms). */
  placedAt: number | null;
  /** Positions in a row with no point of the line within 30 m of the window. */
  offCount: number;
  /** Positions in a row off the track with nothing in the window. */
  farCount: number;
  /** The previous position kept. */
  prev: LonLat | null;
  /** Last position that gave a heading, and the heading (degrees). */
  moveRef: LonLat | null;
  heading: number | null;
  /** On the track: the point of the line. */
  snapped: LonLat | null;
  /** Bearing of the line at the placed point. */
  trackBearing: number | null;
  /** Off the track: distance along the line of the target (m). */
  targetM: number | null;
  /** Approach: distance to the start; off the track: distance to the target (m). */
  gapM: number | null;
};

export function initialPlacement(): Placement {
  return {
    phase: 'approach',
    progressM: 0,
    placedAt: null,
    offCount: 0,
    farCount: 0,
    prev: null,
    moveRef: null,
    heading: null,
    snapped: null,
    trackBearing: null,
    targetM: null,
    gapM: null,
  };
}

/**
 * Where the line is reached from anywhere (the start of the tracking, or
 * after a long way off). The passages within 20 m, those in the heading of
 * the rider when it is known, the first one in the order of the line. With
 * `afterM`, a passage after that distance comes first.
 */
function reach(
  line: TrackingLine,
  here: LonLat,
  heading: number | null,
  afterM: number | null,
): Nearest | null {
  const all = passagesNear(line, here, FIND_M);
  const kept =
    heading === null
      ? all
      : all.filter((n) => angleDiff(n.bearing, heading) <= HEADING_TOLERANCE);
  if (afterM !== null) {
    const ahead = kept.find((n) => n.alongM >= afterM);
    if (ahead) return ahead;
  }
  return kept[0] ?? null;
}

function placed(found: Nearest, fix: Fix): Partial<Placement> {
  return {
    phase: 'onTrack',
    progressM: found.alongM,
    placedAt: fix.at,
    offCount: 0,
    farCount: 0,
    snapped: found.point,
    trackBearing: found.bearing,
    targetM: null,
    gapM: found.gapM,
  };
}

/** Places a fix. A fix less precise than 50 m changes nothing. */
export function placeFix(
  line: TrackingLine,
  before: Placement,
  fix: Fix,
): Placement {
  if (fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_M) return before;
  const here: LonLat = [fix.lon, fix.lat];

  let { moveRef, heading } = before;
  if (!moveRef) {
    moveRef = here;
  } else if (distanceM(moveRef, here) >= HEADING_STEP_M) {
    heading = bearingBetween(moveRef, here);
    moveRef = here;
  }
  const base: Placement = { ...before, prev: here, moveRef, heading };
  const stepM = before.prev ? distanceM(before.prev, here) : 0;
  const seconds =
    before.placedAt === null
      ? 0
      : Math.max(0, (fix.at - before.placedAt) / 1000);
  const fromM = before.progressM - WINDOW_BACK_M;
  const toM = before.progressM + WINDOW_AHEAD_M + MAX_SPEED_MS * seconds;

  if (before.phase === 'approach') {
    const found = reach(line, here, heading, null);
    if (found) return { ...base, ...placed(found, fix) };
    const start = line.points[0] as LonLat;
    return { ...base, gapM: distanceM(here, start) };
  }

  if (before.phase === 'onTrack') {
    const found = bestInWindow(
      line,
      here,
      fromM,
      toM,
      before.progressM + stepM,
      OFF_TRACK_M,
    );
    if (found) return { ...base, ...placed(found, fix) };
    const offCount = before.offCount + 1;
    if (offCount < OFF_TRACK_FIXES) return { ...base, offCount };
    return {
      ...base,
      ...target(line, before, here),
      phase: 'offTrack',
      offCount,
      farCount: 0,
    };
  }

  // offTrack: back on the track under 20 m; between 20 and 30 m nothing changes.
  const back = bestInWindow(
    line,
    here,
    fromM,
    toM,
    before.progressM,
    BACK_ON_TRACK_M,
  );
  if (back) return { ...base, ...placed(back, fix) };
  const near = bestInWindow(
    line,
    here,
    fromM,
    toM,
    before.progressM,
    OFF_TRACK_M,
  );
  const farCount = near ? 0 : before.farCount + 1;
  if (farCount >= RELOCATE_FIXES) {
    const found = reach(line, here, heading, before.progressM - WINDOW_BACK_M);
    if (found) return { ...base, ...placed(found, fix) };
  }
  return { ...base, ...target(line, before, here), farCount };
}

/** The point to rejoin: the closest in [progress - 50 m, progress + 2 km]. */
function target(
  line: TrackingLine,
  at: Placement,
  here: LonLat,
): Partial<Placement> {
  const found = nearestOnLine(
    line,
    here,
    at.progressM - WINDOW_BACK_M,
    at.progressM + TARGET_AHEAD_M,
  );
  return found
    ? { targetM: found.alongM, gapM: found.gapM, snapped: null }
    : {};
}

/**
 * Arrival: the rider is within 30 m of the last point of the line, after 90%
 * of the line (a loop does not end at its start). Also true off the track.
 */
export function hasArrived(
  line: TrackingLine,
  placement: Placement,
  fix: Fix,
): boolean {
  if (placement.phase === 'approach') return false;
  const last = line.points[line.points.length - 1];
  if (!last) return false;
  return (
    placement.progressM >= ARRIVAL_SHARE * line.lengthM &&
    distanceM([fix.lon, fix.lat], last) <= ARRIVAL_M
  );
}

/** Bearing for the camera: the line's on the track, the movement's otherwise. */
export function cameraBearing(placement: Placement): number | null {
  return placement.phase === 'onTrack'
    ? placement.trackBearing
    : placement.heading;
}
