import {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
} from 'react-native-svg';

import { Wheel } from './Cyclist';
import { characterColors, colors, mapColors } from './theme';

const { skin, skinShadow, jerseyShadow } = characterColors;

// The cyclist scratching his helmet and a drawn "?" (mockup 52, pose of
// design/tokens.md: trunk 0, arm -126.5 / -80.2, head -6). To be drawn inside
// an <Svg> with the viewBox "0 0 358 106". With `limit`, the barrier and the
// grey ground of the zone limit are drawn (point outside the zone); without
// it, the ground is plain: no limit is in play. Named groups are kept.
export function CyclistErrorScene({ limit }: { limit: boolean }) {
  return (
    <>
      <Defs>
        <ClipPath id="planche">
          <Rect x={36} y={28} width={88} height={17} rx={3} />
        </ClipPath>
      </Defs>
      <G id="sol">
        <Rect
          x={20}
          y={100}
          width={limit ? 232 : 318}
          height={6}
          rx={3}
          fill={colors.olive}
        />
        {limit && (
          <>
            <Rect
              x={252}
              y={100}
              width={86}
              height={6}
              rx={3}
              fill={mapColors.outsideVeil}
            />
            <Path
              d="M252 58 V106"
              stroke={colors.brown}
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          </>
        )}
      </G>
      <G transform="translate(150 54) scale(0.6)">
        <G id="velo" transform="translate(-80 49)">
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
          <G id="manivelle" transform="rotate(100)">
            <Line
              x2={13}
              stroke={colors.brown}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </G>
        </G>
        {limit && (
          <G id="barriere">
            <Rect x={44} y={30} width={5} height={47} fill={colors.brown} />
            <Rect x={112} y={30} width={5} height={47} fill={colors.brown} />
            <G clipPath="url(#planche)">
              <Rect
                x={36}
                y={28}
                width={88}
                height={17}
                fill={colors.creamLight}
              />
              <Path
                d="M40 28 h12 l-10 17 h-12 Z M64 28 h12 l-10 17 h-12 Z M88 28 h12 l-10 17 h-12 Z M112 28 h12 l-10 17 h-12 Z M136 28 h12 l-10 17 h-12 Z"
                fill={colors.rust}
              />
            </G>
            <Rect
              x={36}
              y={28}
              width={88}
              height={17}
              rx={3}
              fill="none"
              stroke={colors.brown}
              strokeWidth={2.5}
            />
          </G>
        )}
        <G id="vetetiste">
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
          <G id="buste">
            <G id="bras-loin" transform="translate(0 -34) rotate(10)">
              <Line
                y2={20}
                stroke={skinShadow}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <G transform="translate(0 20) rotate(-12)">
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
            <G id="tete" transform="translate(0 -40) rotate(-6)">
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
                d="M4 -4.2 l2 -1.3 l2 1.3 l2 -1.3"
                fill="none"
                stroke={colors.brown}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
            <G id="bras" transform="translate(0 -34) rotate(-126.5)">
              <Line
                y2={20}
                stroke={skin}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <G transform="translate(0 20) rotate(-80.2)">
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
              <Line
                y2={36}
                stroke={skin}
                strokeWidth={8}
                strokeLinecap="round"
              />
              <Ellipse cx={4} cy={37} rx={8} ry={4.5} fill={colors.brown} />
            </G>
          </G>
          <G id="interrogation">
            <Path
              d="M22 -80 a6 6 0 1 1 6 6 v5"
              fill="none"
              stroke={colors.brown}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Circle cx={28} cy={-62} r={2} fill={colors.brown} />
          </G>
        </G>
      </G>
    </>
  );
}
