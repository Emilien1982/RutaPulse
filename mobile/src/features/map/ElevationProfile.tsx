import Svg, {
  ClipPath,
  Defs,
  G,
  Line,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { groupThousands } from '@/core/routing/formatRoute';
import { axisTicks, chartPoints } from '@/core/route-info/chart';
import type { AltitudeInfo } from '@/core/route-info/routeInfo';
import type { TerrainSegment } from '@/core/route-info/terrain';
import { t } from '@/core/i18n/t';
import { colors, mapColors, terrainColors } from '@/ui/theme';

// Drawing area of mockup 20: 358 wide, a plot of 84, the axis at 85, the
// terrain band at 89 (12 high), the labels at 118.
const W = 358;
const PLOT = 84;
const BAND_Y = 89;
const BAND_H = 12;
const H = 122;
const BANDS = [colors.rust, colors.orange, colors.mustard, colors.mustardPale];

function kmLabel(km: number, last: boolean): string {
  const n = String(km).replace('.', ',');
  return last ? t('format.km', { n }) : n;
}

/**
 * Altitude profile of the route: four bands under the line, the terrain
 * band under the axis (when the terrain is known), distances below.
 */
export function ElevationProfile({
  altitudes,
  segments,
}: {
  altitudes: AltitudeInfo;
  /** Null when the terrain is missing or pending: no band. */
  segments: TerrainSegment[] | null;
}) {
  const { profile, minM, maxM } = altitudes;
  const lengthM = profile[profile.length - 1]?.[0] ?? 0;
  const points = chartPoints(profile, minM, maxM, W, PLOT);
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  const area = [`0,${PLOT}`, ...line, `${W},${PLOT}`].join(' ');
  const bandHeight = PLOT / BANDS.length;
  const ticks = axisTicks(lengthM / 1000);
  const toX = (m: number) => (lengthM > 0 ? (m / lengthM) * W : 0);
  return (
    <Svg
      testID="info-profile"
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ aspectRatio: W / H }}
      accessibilityRole="image"
      accessibilityLabel={t('info.profileLabel', {
        min: groupThousands(minM),
        max: groupThousands(maxM),
      })}
    >
      <Defs>
        <ClipPath id="under-profile">
          <Polygon points={area} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#under-profile)">
        {BANDS.map((fill, i) => (
          <Rect
            key={fill}
            x={0}
            y={i * bandHeight}
            width={W}
            height={bandHeight}
            fill={fill}
          />
        ))}
      </G>
      <Polyline
        points={line.join(' ')}
        fill="none"
        stroke={colors.brown}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Line
        x1={0}
        y1={PLOT + 1}
        x2={W}
        y2={PLOT + 1}
        stroke={colors.brown}
        strokeWidth={2}
      />
      {segments?.map((s, i) => {
        const x = toX(s.fromM);
        const width = Math.max(toX(s.toM) - x, 0);
        // "À la main" (terrain.a-la-main): magenta dashes on white, never a
        // flat color, so it is not mistaken for the trail.
        const hand = s.part === 'hand';
        return (
          <G key={i}>
            <Rect
              testID={`info-band-${s.part}`}
              x={x}
              y={BAND_Y}
              width={width}
              height={BAND_H}
              fill={hand ? mapColors.routeCasing : terrainColors[s.part]}
            />
            {hand && (
              <Line
                x1={x}
                y1={BAND_Y + BAND_H / 2}
                x2={x + width}
                y2={BAND_Y + BAND_H / 2}
                stroke={terrainColors.hand}
                strokeWidth={BAND_H}
                strokeDasharray="12 6"
              />
            )}
          </G>
        );
      })}
      {ticks.map((km, i) => {
        const x = toX(km * 1000);
        const last = i === ticks.length - 1 && ticks.length > 1;
        return (
          <SvgText
            key={km}
            x={x}
            y={118}
            fontSize={13}
            fontWeight="500"
            fill={colors.brown2}
            textAnchor={i === 0 ? 'start' : x > W - 24 ? 'end' : 'middle'}
          >
            {kmLabel(km, last)}
          </SvgText>
        );
      })}
    </Svg>
  );
}
