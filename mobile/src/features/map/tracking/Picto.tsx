import Svg, { Circle, Path } from 'react-native-svg';

import type { Direction } from '@/core/tracking/directionText';
import { navColors } from '@/ui/theme';

// The pictograms of the panel (mockup 30, "planche"): drawn in a square of
// 96, stroke 13, round ends, shown in a square of 124. A right turn is the
// left one flipped.
export type PictoKind =
  | 'straight'
  | 'slight'
  | 'turn'
  | 'sharp'
  | 'fork'
  | 'uturn'
  | 'roundabout'
  | 'arrive'
  | 'follow'
  | 'off'
  | 'start'
  | 'gps';

/** The pictogram of a direction. */
export function pictoOf(direction: Direction | null): {
  kind: PictoKind;
  flip: boolean;
} {
  if (!direction) return { kind: 'follow', flip: false };
  if (direction.kind === 'arrive') return { kind: 'arrive', flip: false };
  if (direction.kind === 'follow') return { kind: 'follow', flip: false };
  return { kind: direction.gesture, flip: direction.side === 'right' };
}

const STROKE = 13;

function paths(kind: PictoKind): string[] {
  switch (kind) {
    case 'straight':
      return ['M48 86V18', 'M26 40L48 18L70 40'];
    case 'slight':
      return ['M62 86V62L32 32', 'M30 54V30H54'];
    case 'turn':
      return ['M68 86V52Q68 38 54 38H26', 'M40 22L24 38L40 54'];
    case 'sharp':
      return ['M64 20V50Q64 60 54 60H28', 'M42 44L26 60L42 76'];
    case 'fork':
      return ['M48 86V58L28 34', 'M48 58L68 34', 'M28 56V34H50'];
    case 'uturn':
      return ['M32 86V40Q32 20 52 20Q72 20 72 40V62', 'M58 50L72 64L86 50'];
    case 'roundabout':
      return ['M48 86V66', 'M64 38L80 22', 'M66 22H80V36'];
    case 'arrive':
      return ['M30 88V12', 'M30 14H74L62 32L74 50H30'];
    case 'follow':
      return ['M32 86C32 58 64 58 64 30', 'M48 42L64 26L80 42'];
    case 'off':
      return ['M48 66V34', 'M28 52L48 70L68 52'];
    case 'start':
      return ['M48 74V40'];
    case 'gps':
      return ['M26 48A22 22 0 0 1 70 48', 'M12 48A36 36 0 0 1 84 48'];
  }
}

export function Picto({
  kind,
  flip = false,
  size = 124,
}: {
  kind: PictoKind;
  flip?: boolean;
  size?: number;
}) {
  const color = navColors.text;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {paths(kind).map((d) => (
        <Path key={d} d={d} />
      ))}
      {kind === 'off' && <Circle cx="48" cy="22" r="6" fill={color} />}
      {kind === 'start' && <Circle cx="48" cy="22" r="12" fill={color} />}
      {kind === 'start' && <Circle cx="48" cy="84" r="6" fill={color} />}
      {kind === 'gps' && <Circle cx="48" cy="66" r="8" fill={color} />}
    </Svg>
  );
}
