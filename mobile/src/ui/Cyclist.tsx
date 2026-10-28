import { G, Line, Path, Rect, Circle, Ellipse } from 'react-native-svg';

import { characterColors, colors } from './theme';

const { skin, skinShadow, jerseyShadow } = characterColors;

export function Wheel({ x }: { x: number }) {
  return (
    <G transform={`translate(${x} -2)`}>
      <Circle r={27} fill="none" stroke={colors.brown} strokeWidth={6} />
      <G stroke={colors.brown2} strokeWidth={2}>
        <Line x1={-24} x2={24} />
        <Line x1={-12} y1={-20.8} x2={12} y2={20.8} />
        <Line x1={-12} y1={20.8} x2={12} y2={-20.8} />
      </G>
      <Circle r={3.5} fill={colors.brown} />
    </G>
  );
}

// The ground, the bike and the cyclist looking at a blank map (pose of
// mockup 50, taken from mockup 91). To be drawn inside an <Svg> of 390 wide:
// the named groups are kept so that later phases can animate them.
export function CyclistScene() {
  return (
    <G transform="translate(0 236)">
      <G id="sol">
        <Rect
          x={64}
          y={176}
          width={262}
          height={9}
          rx={4.5}
          fill={colors.olive}
        />
        <G
          fill="none"
          stroke={colors.olive}
          strokeWidth={3}
          strokeLinecap="round"
        >
          <Path d="M80 176 l-3 -8 M86 176 l0 -10 M92 176 l3 -8" />
          <Path d="M300 176 l-3 -7 M306 176 l0 -9 M312 176 l3 -7" />
        </G>
      </G>

      <G id="velo" transform="translate(204 148)">
        <G id="manivelle-loin" transform="rotate(200)">
          <Line
            x2={13}
            stroke={colors.brown2}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </G>
        <G id="roue-arriere">
          <Wheel x={-42} />
        </G>
        <G id="roue-avant">
          <Wheel x={62} />
        </G>
        <Path
          id="cadre"
          d="M-42 -2 L0 0 L-10 -42 Z M-10 -42 L48 -46 L51 -34 L0 0"
          fill="none"
          stroke={colors.petrol}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          id="fourche"
          d="M51 -34 L62 -2"
          stroke={colors.brown2}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          id="tige-selle"
          d="M-10 -42 L-12 -51"
          stroke={colors.brown}
          strokeWidth={4}
        />
        <Path
          id="selle"
          d="M-22 -53 L-3 -53"
          stroke={colors.brown}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          id="guidon"
          d="M48 -46 L50 -55 L43 -57"
          fill="none"
          stroke={colors.brown}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle
          id="plateau"
          r={7}
          fill={colors.creamLight}
          stroke={colors.brown}
          strokeWidth={2.5}
        />
        <G id="manivelle" transform="rotate(20)">
          <Line
            x2={13}
            stroke={colors.brown}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <G transform="translate(13 0) rotate(-20)">
            <Rect
              x={-5}
              y={-2.5}
              width={10}
              height={5}
              rx={2}
              fill={colors.brown}
            />
          </G>
        </G>
      </G>

      <G id="vetetiste" transform="translate(114 100)">
        <G id="jambe-loin" transform="rotate(8)">
          <Line
            y2={36}
            stroke={colors.brown2}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <G id="tibia-loin" transform="translate(0 36) rotate(-4)">
            <Line
              y2={36}
              stroke={skinShadow}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <Ellipse cx={4} cy={37} rx={8} ry={4.5} fill={colors.brown2} />
          </G>
        </G>
        <G id="buste" transform="rotate(3)">
          <G id="bras-loin" transform="translate(0 -34) rotate(-25)">
            <Line
              y2={20}
              stroke={skinShadow}
              strokeWidth={7}
              strokeLinecap="round"
            />
            <G transform="translate(0 20) rotate(-85)">
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
            id="maillot"
            x={-9}
            y={-40}
            width={18}
            height={44}
            rx={9}
            fill={colors.rust}
          />
          <Rect
            id="bande"
            x={-9}
            y={-25}
            width={18}
            height={5}
            fill={colors.mustard}
          />
          <G id="tete" transform="translate(0 -40) rotate(15)">
            <Circle cy={-12} r={12} fill={skin} />
            <Path
              id="casque"
              d="M-13.5 -13 A13.5 13.5 0 0 1 13.5 -13 Z"
              fill={colors.mustard}
            />
            <Path
              id="visiere"
              d="M12 -14 L21 -12 L12.5 -10 Z"
              fill={colors.orange}
            />
            <Circle cx={6.5} cy={-9.5} r={1.8} fill={colors.brown} />
            <Path
              d="M4.5 -4 h5"
              fill="none"
              stroke={colors.brown}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </G>
          <G id="carte-vierge">
            <Path
              d="M20 -46 L54 -40 L52 -12 L18 -18 Z"
              fill={colors.creamLight}
              stroke={colors.brown}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <Path
              d="M31 -44 L29 -16 M42 -42 L40 -14"
              stroke={colors.brown2}
              strokeWidth={1.4}
              strokeDasharray="3 2.5"
            />
          </G>
          <G id="bras" transform="translate(0 -34) rotate(-37)">
            <Line y2={20} stroke={skin} strokeWidth={7} strokeLinecap="round" />
            <G transform="translate(0 20) rotate(-70)">
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
        <G id="jambe" transform="rotate(-6)">
          <Line
            y2={36}
            stroke={colors.brown}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <G id="tibia" transform="translate(0 36) rotate(8)">
            <Line y2={36} stroke={skin} strokeWidth={8} strokeLinecap="round" />
            <Ellipse cx={4} cy={37} rx={8} ry={4.5} fill={colors.brown} />
          </G>
        </G>
      </G>
    </G>
  );
}
