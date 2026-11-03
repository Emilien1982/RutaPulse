import Svg, { Line } from 'react-native-svg';

// Full-width dashed rule of 2 (mockup 41): drawn in SVG because React Native
// draws a one-sided `dashed` border as a plain line on Android.
export function DashedRule() {
  return (
    <Svg
      width="100%"
      height={2}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Line
        x1={0}
        y1={1}
        x2="100%"
        y2={1}
        stroke="rgba(58,31,15,0.55)"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
    </Svg>
  );
}
