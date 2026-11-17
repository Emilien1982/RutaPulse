// The state of the tracking and its transitions (ADR 0021, section 5.1), and
// what the panel shows (section 3). Pure logic: the Store only holds the
// state and calls `reduceTracking`.

import { t } from '@/core/i18n/t';
import { groupThousands } from '@/core/routing/formatRoute';

import { buildGuidance } from './guidance';
import type { Direction } from './directionText';
import {
  ARRIVAL_M,
  hasArrived,
  initialPlacement,
  MAX_ACCURACY_M,
  placeFix,
  type Fix,
  type Placement,
} from './placement';
import { remainingM } from './remaining';
import { addRideFix, MIN_RIDE_M, startRide, type Ride } from './ride';
import {
  distanceM,
  type FreeReason,
  type TrackingLine,
  type TrackingSource,
} from './trackingLine';

/** Without a position for this long (ms), the GPS is lost. */
export const GPS_LOST_MS = 10_000;
/** Without any position for this long (ms), the waiting message grows. */
export const GPS_SILENT_MS = 30_000;
/** A position is processed when this long (ms) has passed since the last one. */
export const MIN_FIX_GAP_MS = 900;
/** The panel turns yellow at this distance (m) or less. */
export const IMMINENT_M = 100;
/** At the start, a first position needs a next one at less than this speed (m/s). */
export const MAX_START_SPEED_MS = 25;
/** With no time between two positions, they must be this close (m). */
const SAME_SPOT_M = 5;

export type TrackingStatus = 'tracking' | 'paused' | 'ended';

export type TrackingState = {
  status: TrackingStatus;
  /** How it ended: by arrival, or by "Terminer". */
  end: 'arrived' | 'finished' | null;
  line: TrackingLine;
  directions: Direction[];
  placement: Placement;
  ride: Ride;
  /** ms. */
  startedAt: number;
  endedAt: number | null;
  /** A position has come (even one that is too imprecise). */
  hasFix: boolean;
  /** Time of the last position, or of the start or the resume (ms). */
  signalAt: number;
  /** Time of the last position processed (ms). */
  lastFixAt: number | null;
  /** Accuracy (m) of the last position kept, for the halo of the dot. */
  accuracyM: number | null;
  gpsLost: boolean;
  /** No position for 30 s since the start. */
  gpsSilent: boolean;
  /**
   * Start rule: the only position kept since the start, until a second one
   * confirms it; 'done' once two coherent positions have been kept.
   */
  startCheck: Fix | 'done' | null;
};

export type TrackingEvent =
  | { type: 'fix'; fix: Fix }
  | { type: 'guidance'; directions: Direction[] }
  | { type: 'pause'; at: number }
  | { type: 'resume'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'finish'; at: number };

/**
 * The state at the start. Until the directions are ready, the whole line is
 * free ("Suivez le tracé"), apart from the reasons we know.
 */
export function createTracking(
  source: TrackingSource,
  startedAt: number,
): TrackingState {
  return {
    status: 'tracking',
    end: null,
    line: source.line,
    directions: buildGuidance(source, []),
    placement: initialPlacement(),
    ride: startRide(startedAt),
    startedAt,
    endedAt: null,
    hasFix: false,
    signalAt: startedAt,
    lastFixAt: null,
    accuracyM: null,
    gpsLost: false,
    gpsSilent: false,
    startCheck: null,
  };
}

/** True while the GPS must be on. */
export function wantsGps(state: TrackingState): boolean {
  return state.status === 'tracking';
}

function ended(
  state: TrackingState,
  end: 'arrived' | 'finished',
  at: number,
): TrackingState {
  return { ...state, status: 'ended', end, endedAt: at };
}

function timeOf(fix: Fix): number {
  return fix.takenAt ?? fix.at;
}

/** Can `next` follow `first` at a speed under `MAX_START_SPEED_MS`? */
function plausible(first: Fix, next: Fix): boolean {
  const meters = distanceM([first.lon, first.lat], [next.lon, next.lat]);
  const seconds = (timeOf(next) - timeOf(first)) / 1000;
  if (seconds <= 0) return meters <= SAME_SPOT_M;
  return meters / seconds < MAX_START_SPEED_MS;
}

/** Places a position (already filtered as recent and precise enough). */
function accept(state: TrackingState, fix: Fix): TrackingState {
  if (state.lastFixAt !== null && fix.at - state.lastFixAt < MIN_FIX_GAP_MS) {
    return state;
  }
  const placement = placeFix(state.line, state.placement, fix);
  const next: TrackingState = {
    ...state,
    startCheck: state.startCheck === null ? fix : 'done',
    placement,
    ride: addRideFix(state.ride, fix),
    lastFixAt: fix.at,
    accuracyM: fix.accuracy,
  };
  // Starting on the end point is not arriving: 100 m must really be ridden.
  return next.ride.distanceM >= MIN_RIDE_M &&
    hasArrived(state.line, placement, fix)
    ? ended(next, 'arrived', fix.at)
    : next;
}

export function reduceTracking(
  state: TrackingState,
  event: TrackingEvent,
): TrackingState {
  if (event.type === 'guidance') {
    return { ...state, directions: event.directions };
  }
  if (state.status === 'ended') return state;
  switch (event.type) {
    case 'fix': {
      if (state.status !== 'tracking') return state;
      const { fix } = event;
      // A stale position (taken before the start) is ignored altogether.
      if (fix.takenAt !== undefined && fix.takenAt < state.startedAt) {
        return state;
      }
      const heard: TrackingState = {
        ...state,
        hasFix: true,
        signalAt: fix.at,
        gpsLost: false,
        gpsSilent: false,
      };
      if (fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_M) return heard;
      if (
        state.lastFixAt !== null &&
        fix.at - state.lastFixAt < MIN_FIX_GAP_MS
      ) {
        return heard;
      }
      const first = state.startCheck;
      if (first !== null && first !== 'done' && !plausible(first, fix)) {
        // The first position was an old one: start again from the new one.
        return accept(
          {
            ...heard,
            placement: initialPlacement(),
            ride: startRide(state.startedAt),
            lastFixAt: null,
            accuracyM: null,
            startCheck: null,
          },
          fix,
        );
      }
      return accept(heard, fix);
    }
    case 'pause':
      return state.status === 'tracking'
        ? { ...state, status: 'paused' }
        : state;
    case 'resume':
      return state.status === 'paused'
        ? { ...state, status: 'tracking', signalAt: event.at }
        : state;
    case 'tick': {
      if (state.status !== 'tracking') return state;
      const silent = event.at - state.signalAt;
      return {
        ...state,
        gpsLost: state.hasFix && silent > GPS_LOST_MS,
        gpsSilent: !state.hasFix && silent > GPS_SILENT_MS,
      };
    }
    case 'finish':
      return ended(state, 'finished', event.at);
  }
}

export type PanelKind =
  'waiting' | 'approach' | 'off' | 'follow' | 'arrive' | 'turn';

/** What the panel at the top shows (ADR 0021, section 3). */
export type Panel = {
  kind: PanelKind;
  /** Distance of the big number (m); null while waiting for the GPS. */
  distanceM: number | null;
  /** The direction shown ("follow the track" ahead is a direction too). */
  direction: Direction | null;
  /** Why a stretch has no direction (kind 'follow', or 'arrive' in such a stretch). */
  reason: FreeReason | null;
  /** Yellow: a turn or the arrival at 100 m or less. */
  imminent: boolean;
  gpsLost: boolean;
  /** No position for 30 s since the start. */
  silent: boolean;
};

/** `remainingM` to the millimeter: the float noise of the sphere is not a distance. */
function arrivalM(line: TrackingLine, placement: Placement): number {
  return Math.round(remainingM(line, placement) * 1000) / 1000;
}

/** The panel, by the order of priority of the mock-up 30. */
export function panelOf(state: TrackingState): Panel {
  const { placement, line, directions } = state;
  const base: Panel = {
    kind: 'turn',
    distanceM: null,
    direction: null,
    reason: null,
    imminent: false,
    gpsLost: state.gpsLost,
    silent: state.gpsSilent,
  };
  // Waiting until a position has really been placed (one of 50 m or worse
  // only says that the GPS answers).
  if (state.placement.prev === null) return { ...base, kind: 'waiting' };
  if (placement.phase === 'approach') {
    return { ...base, kind: 'approach', distanceM: placement.gapM };
  }
  if (placement.phase === 'offTrack') {
    return { ...base, kind: 'off', distanceM: placement.gapM };
  }
  const at = placement.progressM;
  const inside = directions.find(
    (d) => d.kind === 'follow' && d.fromM <= at && at < d.toM,
  );
  if (inside && inside.kind === 'follow') {
    const toM = inside.toM - at;
    // A stretch that runs to the arrival stays "Suivez le tracé" (with the
    // distance and the reason) until the arrival is in sight: 100 m or less.
    const inSight = inside.toM >= line.lengthM - 1 && toM <= IMMINENT_M;
    return {
      ...base,
      kind: inSight ? 'arrive' : 'follow',
      // On the arrival, the same distance as "Reste" (ADR 0021, section 11.1).
      distanceM: inSight ? arrivalM(line, placement) : toM,
      direction: inSight ? (directions[directions.length - 1] ?? null) : inside,
      reason: inside.reason === 'noMatch' ? null : inside.reason,
      imminent: inSight,
    };
  }
  // The next direction: a turn not passed yet, a stretch without direction
  // ahead (announced as a direction), or the arrival.
  const next = directions.find((d) =>
    d.kind === 'turn' ? d.atM >= at : d.kind === 'follow' ? d.fromM > at : true,
  );
  if (!next)
    return { ...base, kind: 'arrive', distanceM: arrivalM(line, placement) };
  const distance =
    next.kind === 'arrive'
      ? arrivalM(line, placement)
      : (next.kind === 'follow' ? next.fromM : next.atM) - at;
  return {
    ...base,
    kind: next.kind === 'arrive' ? 'arrive' : 'turn',
    distanceM: distance,
    direction: next,
    // "Follow the track" ahead is announced on white, never yellow.
    imminent: next.kind !== 'follow' && distance <= IMMINENT_M,
  };
}

/** Distance left to ride (m), for the bottom bar. */
export function remainingOf(state: TrackingState): number {
  return remainingM(state.line, state.placement);
}

/**
 * The big distance of the panel: from 1 km, one decimal (none from 10 km);
 * 300 to 999 m, rounded to 50 m; under 300 m, rounded to 10 m, never 0.
 */
export function panelDistance(meters: number): { value: string; unit: string } {
  const m = Math.max(0, meters);
  const km = (n: string) => ({ value: n, unit: t('tracking.unit.km') });
  if (m >= 1000) {
    // Round first, then choose the format: 9 960 m is "10 km", not "10,0 km".
    const tenths = Math.round(m / 100) / 10;
    return km(
      tenths >= 10
        ? String(Math.round(m / 1000))
        : tenths.toFixed(1).replace('.', ','),
    );
  }
  const rounded =
    m >= 300 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10);
  if (rounded >= 1000) return km('1,0');
  return { value: String(rounded), unit: t('tracking.unit.m') };
}

/**
 * The big number of the panel, or null when it only says "Arrivée": on the
 * arrival, under 30 m (ADR 0021, section 11.1).
 */
export function panelNumber(
  panel: Panel,
): { value: string; unit: string } | null {
  if (panel.distanceM === null) return null;
  if (panel.kind === 'arrive' && panel.distanceM < ARRIVAL_M) return null;
  return panelDistance(panel.distanceM);
}

/**
 * "Reste" at the bottom: from 1 km one decimal (none from 100 km), under
 * 1 km rounded to 10 m. Rounded first, then formatted.
 */
export function formatRemaining(meters: number): string {
  const m = Math.max(0, meters);
  if (m >= 1000) {
    const tenths = Math.round(m / 100) / 10;
    return t('format.km', {
      n:
        tenths >= 100
          ? String(Math.round(m / 1000))
          : tenths.toFixed(1).replace('.', ','),
    });
  }
  const rounded = Math.round(m / 10) * 10;
  if (rounded >= 1000) return t('format.km', { n: '1,0' });
  return t('format.m', { n: String(rounded) });
}

/** "D+ restant": whole meters, or "—" when the altitudes are unknown. */
export function formatClimbLeft(meters: number | null): string {
  return meters === null
    ? t('route.noFigure')
    : t('format.m', { n: groupThousands(meters) });
}
