import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from './theme';

// Pictograms of the mockups, drawn in a 24 x 24 square. Decorative: the
// button or tab that holds them carries the accessible label.
type IconProps = { color: string; size?: number };

function Icon({
  color,
  size = 24,
  strokeWidth,
  children,
}: IconProps & { strokeWidth: number; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      {children}
    </Svg>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={2.2}>
      <Path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <Path d="M9 4v14M15 6v14" />
    </Icon>
  );
}

export function RoutesIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={2.5}>
      <Path d="M9 6h11M9 12h11M9 18h11" />
      <Circle cx="4.5" cy="6" r="1.5" fill={props.color} />
      <Circle cx="4.5" cy="12" r="1.5" fill={props.color} />
      <Circle cx="4.5" cy="18" r="1.5" fill={props.color} />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={2.2}>
      <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Icon>
  );
}

export function SettingsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="8.6"
        stroke={color}
        strokeWidth={3.2}
        strokeDasharray="3.4 3.35"
      />
      <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth={3.4} />
    </Svg>
  );
}

export function LocateIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={2.3}>
      <Circle cx="12" cy="12" r="7" />
      <Circle cx="12" cy="12" r="2.5" fill={props.color} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Icon>
  );
}

// The locate pictogram crossed out: the position is refused (mockup 90).
export function LocateOffIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={2.3}>
      <Circle cx="12" cy="12" r="7" />
      <Circle cx="12" cy="12" r="2.5" fill={props.color} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <Path d="M4 4L20 20" stroke={colors.creamLight} strokeWidth={5} />
      <Path d="M4 4L20 20" stroke={props.color} strokeWidth={2.3} />
    </Icon>
  );
}

export function CheckIcon({ size = 18, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={3.2}>
      <Path d="M5 12l5 5 9-10" />
    </Icon>
  );
}

export function CloseIcon({ size = 22, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={2.8}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function PauseIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x="6" y="4" width="4" height="16" rx="1" />
      <Rect x="14" y="4" width="4" height="16" rx="1" />
    </Svg>
  );
}

export function MoreIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="12" cy="5" r="2.3" />
      <Circle cx="12" cy="12" r="2.3" />
      <Circle cx="12" cy="19" r="2.3" />
    </Svg>
  );
}

export function WifiOffIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={2.4}>
      <Path d="M2 8.5a15 15 0 0 1 20 0" />
      <Path d="M5.5 12a10 10 0 0 1 13 0" />
      <Path d="M9 15.5a5 5 0 0 1 6 0" />
      <Circle cx="12" cy="19" r="1.3" fill={props.color} />
      <Path d="M3 3l18 18" />
    </Icon>
  );
}

export function PlusIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={2.8}>
      <Path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

// Tools of the creation sheet (mockup 10).
export function UndoIcon({ size = 22, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={2.5}>
      <Path d="M9 5L4 10l5 5" />
      <Path d="M4 10h10a6 6 0 0 1 6 6v2" />
    </Icon>
  );
}

export function LoopIcon({ size = 22, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={2.5}>
      <Path d="M20 12a8 8 0 1 1-3-6.2" />
      <Path d="M17.5 2.5v4h-4" />
      <Circle cx="12" cy="12" r="2.2" fill={props.color} stroke="none" />
    </Icon>
  );
}

export function TrashIcon({ size = 22, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={2.3}>
      <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </Icon>
  );
}

// Modes of the next leg: along the paths, by hand.
export function PathModeIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={2.3}>
      <Path d="M6 18c0-7 12-5 12-12" />
      <Circle cx="6" cy="19" r="2" fill={props.color} />
      <Circle cx="18" cy="5" r="2" fill={props.color} />
    </Icon>
  );
}

export function HandModeIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon {...props} size={size} strokeWidth={2.3}>
      <Path d="M4 20l4-1 11-11-3-3L5 16z" />
    </Icon>
  );
}
