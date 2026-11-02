import Svg, { Path } from 'react-native-svg';

// Dashed stroke of 22 x 8: the sign of the legs drawn by hand.
export function DashedStroke({ color }: { color: string }) {
  return (
    <Svg width={22} height={8} viewBox="0 0 22 8">
      <Path d="M1 4h20" stroke={color} strokeWidth={4} strokeDasharray="6 3" />
    </Svg>
  );
}
