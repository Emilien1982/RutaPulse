// The text of a direction (ADR 0021, section 1.4): the gesture, then the kind
// of way. Texts come from `fr.ts` through `t()`. No street name.

import type { TextKey } from '@/core/i18n/fr';
import { t } from '@/core/i18n/t';

import type { FreeReason } from './trackingLine';

export type Gesture =
  'slight' | 'turn' | 'sharp' | 'fork' | 'straight' | 'uturn' | 'roundabout';
export type Side = 'left' | 'right';
export type Way = 'trail' | 'track' | 'road';

/** A turn without its place. */
export type TurnStep = {
  gesture: Gesture;
  side?: Side;
  exit?: number;
  way?: Way;
};

export type Direction =
  | {
      kind: 'turn';
      /** Distance along the line (m). */
      atM: number;
      gesture: Gesture;
      side?: Side;
      /** Roundabout: number of the exit. */
      exit?: number;
      way?: Way;
      /** A second turn announced with this one (less than 25 m after it). */
      then?: TurnStep;
    }
  | { kind: 'follow'; fromM: number; toM: number; reason: FreeReason }
  | { kind: 'arrive'; atM: number };

export type DirectionText = {
  key: TextKey;
  params?: Record<string, string | number>;
  /** Key of the kind of way, when it is known. */
  wayKey?: TextKey;
};

const SIDE_KEYS = {
  slight: {
    left: 'tracking.gesture.slightLeft',
    right: 'tracking.gesture.slightRight',
  },
  turn: {
    left: 'tracking.gesture.turnLeft',
    right: 'tracking.gesture.turnRight',
  },
  sharp: {
    left: 'tracking.gesture.sharpLeft',
    right: 'tracking.gesture.sharpRight',
  },
  fork: {
    left: 'tracking.gesture.forkLeft',
    right: 'tracking.gesture.forkRight',
  },
} as const satisfies Record<string, Record<Side, TextKey>>;

const WAY_KEYS: Record<Way, TextKey> = {
  trail: 'tracking.way.trail',
  track: 'tracking.way.track',
  road: 'tracking.way.road',
};

/** The text of a turn alone. */
function stepText(step: TurnStep): DirectionText {
  const { gesture, side, exit, way } = step;
  if (gesture === 'uturn') return { key: 'tracking.gesture.uturn' };
  if (gesture === 'roundabout') {
    if (exit === undefined) return { key: 'tracking.gesture.roundaboutAny' };
    return exit === 1
      ? { key: 'tracking.gesture.roundaboutFirst' }
      : { key: 'tracking.gesture.roundabout', params: { n: exit } };
  }
  const wayKey = way ? { wayKey: WAY_KEYS[way] } : {};
  if (gesture === 'straight') {
    return { key: 'tracking.gesture.straight', ...wayKey };
  }
  return { key: SIDE_KEYS[gesture][side ?? 'right'], ...wayKey };
}

function stepLabel(step: TurnStep): string {
  const { key, params, wayKey } = stepText(step);
  const gesture = t(key, params);
  return wayKey ? t('tracking.withWay', { gesture, way: t(wayKey) }) : gesture;
}

/** The second turn of a pair, in lower case, without "Tournez": "à droite sur la piste". */
function secondLabel(step: TurnStep): string {
  const text = stepLabel(step).replace(/^Tournez /, '');
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** The key and the parameters of a direction. */
export function directionText(direction: Direction): DirectionText {
  if (direction.kind === 'arrive') return { key: 'tracking.arrive' };
  if (direction.kind === 'follow') return { key: 'tracking.follow' };
  if (direction.then) {
    return {
      key: 'tracking.then',
      params: {
        first: stepLabel(direction),
        second: secondLabel(direction.then),
      },
    };
  }
  return stepText(direction);
}

/** The sentence of a direction ("Tournez à gauche sur la piste"). */
export function directionLabel(direction: Direction): string {
  const { key, params, wayKey } = directionText(direction);
  const text = t(key, params);
  return wayKey
    ? t('tracking.withWay', { gesture: text, way: t(wayKey) })
    : text;
}
