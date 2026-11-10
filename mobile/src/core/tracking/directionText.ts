// The text of a direction (ADR 0021, section 1.4): the gesture, then the kind
// of way. Texts come from `fr.ts` through `t()`. No street name.

import type { TextKey } from '@/core/i18n/fr';
import { t } from '@/core/i18n/t';

import type { FreeReason } from './trackingLine';

export type Gesture =
  'slight' | 'turn' | 'sharp' | 'fork' | 'straight' | 'uturn' | 'roundabout';
export type Side = 'left' | 'right';
export type Way = 'trail' | 'track' | 'road';

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

/** The key and the parameters of a direction. */
export function directionText(direction: Direction): DirectionText {
  if (direction.kind === 'arrive') return { key: 'tracking.arrive' };
  if (direction.kind === 'follow') return { key: 'tracking.follow' };
  const { gesture, side, exit, way } = direction;
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

/** The sentence of a direction ("Tournez à gauche sur la piste"). */
export function directionLabel(direction: Direction): string {
  const { key, params, wayKey } = directionText(direction);
  const gesture = t(key, params);
  return wayKey ? t('tracking.withWay', { gesture, way: t(wayKey) }) : gesture;
}
