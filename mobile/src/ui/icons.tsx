import Svg, { Circle, Path } from 'react-native-svg';

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
