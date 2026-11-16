import {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Svg,
  Text as SvgText,
} from 'react-native-svg';

import { characterColors, colors } from './theme';

const { skin, skinShadow, jerseyShadow } = characterColors;
const mud = '#7A4A1E';
const RAYS = [
  '195,250 -135,250 -130.1,192.6',
  '195,250 -115.2,137.1 -90.8,85',
  '195,250 -57.8,37.8 -17.2,-2.8',
  '195,250 30,-35.8 82.1,-60.2',
  '195,250 137.6,-75.1 195,-80',
  '195,250 252.4,-75.1 307.9,-60.2',
  '195,250 360,-35.8 407.2,-2.8',
  '195,250 447.8,37.8 480.8,85',
  '195,250 505.2,137.1 520.1,192.6',
];
const CONFETTI: [number, number, number, string][] = [
  [58, 72, 20, colors.petrol],
  [332, 58, -30, colors.orange],
  [98, 30, 45, colors.rust],
  [300, 120, 15, colors.petrol],
  [36, 160, -20, colors.rust],
  [356, 176, 30, colors.orange],
  [140, 64, -50, colors.brown],
];

function Wheel({ x, withMud }: { x: number; withMud?: boolean }) {
  return (
    <G transform={`translate(${x} -2)`}>
      <Circle r={27} fill="none" stroke={colors.brown} strokeWidth={6} />
      <G stroke={colors.brown2} strokeWidth={2}>
        <Line x1={-24} x2={24} />
        <Line x1={-12} y1={-20.8} x2={12} y2={20.8} />
        <Line x1={-12} y1={20.8} x2={12} y2={-20.8} />
      </G>
      <Circle r={3.5} fill={colors.brown} />
      {withMud ? (
        <G fill={mud}>
          <Ellipse cx={-22} cy={12} rx={5} ry={3} />
          <Ellipse cx={14} cy={22} rx={4} ry={2.5} />
        </G>
      ) : null}
    </G>
  );
}

// The still illustration of mockup v1/60: the muddy rider on the podium,
// the bike parked behind. The last picture of the animation planned for V2.
export function RidePodium() {
  return (
    <Svg width="100%" viewBox="0 0 390 330" style={{ aspectRatio: 390 / 330 }}>
      <G fill={colors.mustardPale}>
        {RAYS.map((points) => (
          <Polygon key={points} points={points} />
        ))}
      </G>
      {CONFETTI.map(([x, y, angle, fill]) => (
        <Rect
          key={`${x}-${y}`}
          x={-2.5}
          y={-4.5}
          width={5}
          height={9}
          fill={fill}
          transform={`translate(${x} ${y}) rotate(${angle})`}
        />
      ))}
      <Rect x={0} y={290} width={390} height={9} fill={colors.mustard} />
      <Rect x={0} y={299} width={390} height={9} fill={colors.orange} />
      <Rect x={0} y={308} width={390} height={9} fill={colors.rust} />
      <Rect x={0} y={317} width={390} height={13} fill={colors.brown} />

      <G transform="translate(78 262)">
        <Wheel x={-42} withMud />
        <Wheel x={62} />
        <Path
          d="M-42 -2 L0 0 L-10 -42 Z M-10 -42 L48 -46 L51 -34 L0 0"
          fill="none"
          stroke={colors.petrol}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <G fill={mud}>
          <Ellipse cx={-24} cy={-4} rx={5} ry={3} />
          <Ellipse cx={20} cy={-44} rx={4} ry={2.5} />
          <Circle cx={-6} cy={-24} r={2.5} />
        </G>
        <Path
          d="M51 -34 L62 -2"
          stroke={colors.brown2}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path d="M-10 -42 L-12 -51" stroke={colors.brown} strokeWidth={4} />
        <Path
          d="M-22 -53 L-3 -53"
          stroke={colors.brown}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M48 -46 L50 -55 L43 -57"
          fill="none"
          stroke={colors.brown}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>

      <G stroke={colors.brown} strokeWidth={3} strokeLinejoin="round">
        <Rect x={75} y={240} width={80} height={50} fill={colors.orange} />
        <Rect x={235} y={255} width={80} height={35} fill={colors.rust} />
        <Rect x={155} y={217} width={80} height={73} fill={colors.mustard} />
      </G>
      <G fill={colors.creamLight} stroke={colors.brown} strokeWidth={2.5}>
        <Circle cx={195} cy={246} r={14} />
        <Circle cx={115} cy={265} r={13} />
        <Circle cx={275} cy={273} r={12} />
      </G>
      <G fill={colors.brown} fontWeight="700" textAnchor="middle">
        <SvgText x={195} y={252.5} fontSize={18}>
          1
        </SvgText>
        <SvgText x={115} y={271} fontSize={17}>
          2
        </SvgText>
        <SvgText x={275} y={278.5} fontSize={15}>
          3
        </SvgText>
      </G>

      <G transform="translate(195 140)">
        <G transform="rotate(8)">
          <Line
            y2={36}
            stroke={colors.brown2}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <G transform="translate(0 36) rotate(-4)">
            <Line
              y2={36}
              stroke={skinShadow}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <Ellipse cx={0} cy={22} rx={4} ry={6.5} fill={mud} />
            <Ellipse cx={4} cy={37} rx={8} ry={4.5} fill={colors.brown2} />
          </G>
        </G>
        <G>
          <G transform="translate(0 -34) rotate(150)">
            <Line
              y2={20}
              stroke={skinShadow}
              strokeWidth={7}
              strokeLinecap="round"
            />
            <G transform="translate(0 20) rotate(20)">
              <Line
                y2={18}
                stroke={skinShadow}
                strokeWidth={6}
                strokeLinecap="round"
              />
              <Circle cy={19} r={4.5} fill={colors.brown2} />
            </G>
            <Circle cy={2} r={6.5} fill={jerseyShadow} />
          </G>
          <Rect
            x={-9}
            y={-40}
            width={18}
            height={44}
            rx={9}
            fill={colors.rust}
          />
          <Rect x={-9} y={-25} width={18} height={5} fill={colors.mustard} />
          <G fill={mud}>
            <Circle cx={-3} cy={-9} r={2.8} />
            <Circle cx={4} cy={-31} r={2} />
            <Circle cx={3} cy={-4} r={1.8} />
          </G>
          <G transform="translate(0 -40) rotate(-10)">
            <Circle cy={-12} r={12} fill={skin} />
            <Path
              d="M-13.5 -13 A13.5 13.5 0 0 1 13.5 -13 Z"
              fill={colors.mustard}
            />
            <Path d="M12 -14 L21 -12 L12.5 -10 Z" fill={colors.orange} />
            <G fill={mud}>
              <Circle cx={-4} cy={-7} r={2.6} />
              <Circle cx={-6} cy={-19} r={2.2} />
              <Circle cx={2} cy={-23} r={1.6} />
            </G>
            <Circle cx={6.5} cy={-9.5} r={1.8} fill={colors.brown} />
            <Path d="M3.5 -6 Q8 0.5 11.5 -6.5 Z" fill={colors.brown} />
          </G>
          <G transform="translate(27 -61)">
            <G
              stroke={colors.brown}
              strokeWidth={2.2}
              strokeLinecap="round"
              fill="none"
            >
              <Path d="M0 -34 V-41 M-9 -33 L-13 -38 M9 -33 L13 -38" />
              <Path d="M-10 -25 q-7 0 -7 6 q0 5 7 5" />
              <Path d="M10 -25 q7 0 7 6 q0 5 -7 5" />
            </G>
            <Path
              d="M-10 -29 H10 Q10 -11 0 -11 Q-10 -11 -10 -29 Z"
              fill={colors.mustard}
              stroke={colors.brown}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <Rect
              x={-2}
              y={-11}
              width={4}
              height={8}
              fill={colors.mustard}
              stroke={colors.brown}
              strokeWidth={1.6}
            />
            <Rect
              x={-8}
              y={-4}
              width={16}
              height={5}
              rx={1}
              fill={colors.brown}
            />
          </G>
          <G transform="translate(0 -34) rotate(-130)">
            <Line y2={20} stroke={skin} strokeWidth={7} strokeLinecap="round" />
            <G transform="translate(0 20) rotate(-10)">
              <Line
                y2={18}
                stroke={skin}
                strokeWidth={6}
                strokeLinecap="round"
              />
              <Circle cy={19} r={4.5} fill={colors.brown} />
            </G>
            <Circle cy={2} r={6.5} fill={colors.rust} />
          </G>
        </G>
        <G transform="rotate(-6)">
          <Line
            y2={36}
            stroke={colors.brown}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <G transform="translate(0 36) rotate(8)">
            <Line y2={36} stroke={skin} strokeWidth={8} strokeLinecap="round" />
            <G fill={mud}>
              <Ellipse cx={1} cy={17} rx={4.5} ry={7} />
              <Circle cx={-2} cy={29} r={2.5} />
            </G>
            <Ellipse cx={4} cy={37} rx={8} ry={4.5} fill={colors.brown} />
          </G>
        </G>
      </G>
    </Svg>
  );
}
