// The track alone, in SVG, on the plain map background (ADR 0019, section 3):
// the arch without a zone, and later the medallion of the list.

import Svg, { Circle, Polyline } from 'react-native-svg';

import { colors, mapColors } from '@/ui/theme';

/** [lon, lat] points. */
export function RoutePreview({
  track,
  width,
  height,
  padding = 24,
  lineWidth = 5,
  dotRadius = 8,
  background = mapColors.background,
}: {
  track: readonly (readonly number[])[];
  width: number;
  height: number;
  padding?: number;
  /** Width of the route line; the casing is 3 wider. */
  lineWidth?: number;
  dotRadius?: number;
  /** Color behind the track (the map background by default). */
  background?: string;
}) {
  if (track.length < 2) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of track) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  // Longitudes shrink with the latitude.
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const spanX = Math.max((east - west) * k, 1e-9);
  const spanY = Math.max(north - south, 1e-9);
  const scale = Math.min(
    (width - 2 * padding) / spanX,
    (height - 2 * padding) / spanY,
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const project = ([lon, lat]: readonly number[]): [number, number] => [
    offsetX + (lon - west) * k * scale,
    offsetY + (north - lat) * scale,
  ];
  const points = track.map(project);
  const line = points.map(([x, y]) => `${x},${y}`).join(' ');
  const [startX, startY] = points[0];
  const [endX, endY] = points[points.length - 1];
  return (
    <Svg
      width={width}
      height={height}
      style={{ backgroundColor: background }}
      accessible={false}
    >
      {(
        [
          [mapColors.routeCasing, lineWidth + 3],
          [mapColors.route, lineWidth],
        ] as const
      ).map(([stroke, strokeWidth]) => (
        <Polyline
          key={strokeWidth}
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <Circle
        cx={endX}
        cy={endY}
        r={dotRadius}
        fill={mapColors.end}
        stroke={colors.creamLight}
        strokeWidth={2}
      />
      <Circle
        cx={startX}
        cy={startY}
        r={dotRadius}
        fill={mapColors.start}
        stroke={colors.creamLight}
        strokeWidth={2}
      />
    </Svg>
  );
}
