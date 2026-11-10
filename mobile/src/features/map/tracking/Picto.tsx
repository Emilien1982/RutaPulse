import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { Direction } from '@/core/tracking/directionText';
import { mapColors, navColors } from '@/ui/theme';

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
    case 'follow':
      return [
        'M56 90C56 70 32 66 32 48C32 32 50 30 50 18',
        'M34 30L50 12L66 30',
      ];
    case 'arrive':
    case 'off':
    case 'start':
      return [];
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
      {kind === 'off' && <GapDrawing />}
      {kind === 'start' && <StartDrawing />}
      {kind === 'arrive' && <FinishDrawing />}
      {kind === 'gps' && <Circle cx="48" cy="66" r="8" fill={color} />}
    </Svg>
  );
}

// The three drawings of the mockup 30 that are not strokes of one color.
// p-ecart: the rider (blue), dots, the track (magenta with a white edge). No arrow.
function GapDrawing() {
  return (
    <G>
      <Path d="M76 8V88" stroke="#FFFFFF" strokeWidth={20} />
      <Path d="M76 8V88" stroke={mapColors.route} strokeWidth={13} />
      <Path
        d="M40 48H64"
        stroke={navColors.text}
        strokeWidth={7}
        strokeDasharray="0 12"
      />
      <Circle cx="22" cy="48" r="15" fill={mapColors.position} />
      <Circle
        cx="22"
        cy="48"
        r="15"
        fill="none"
        stroke={navColors.text}
        strokeWidth={2}
      />
    </G>
  );
}

// p-depart: a green disc with a white triangle.
function StartDrawing() {
  return (
    <G stroke="none">
      <Circle cx="48" cy="48" r="34" fill={mapColors.start} />
      <Path d="M38 30L64 48L38 66Z" fill="#FFFFFF" />
    </G>
  );
}

// p-arrivee: a pole and a chequered flag.
function FinishDrawing() {
  const black = navColors.text;
  return (
    <G>
      <Path d="M28 90V10" stroke={black} strokeWidth={10} />
      <Rect
        x="34"
        y="12"
        width="48"
        height="36"
        fill="#FFFFFF"
        stroke={black}
        strokeWidth={5}
      />
      <G fill={black} stroke="none">
        <Rect x="34" y="12" width="12" height="12" />
        <Rect x="58" y="12" width="12" height="12" />
        <Rect x="46" y="24" width="12" height="12" />
        <Rect x="70" y="24" width="12" height="12" />
        <Rect x="34" y="36" width="12" height="12" />
        <Rect x="58" y="36" width="12" height="12" />
      </G>
    </G>
  );
}
