import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ComponentProps } from 'react';
import { memo, useMemo } from 'react';

import { CHEVRON_BANDS, chevronsToMapData } from '@/core/trails/chevrons';
import {
  chosenToMapData,
  trailsToMapData,
  type Trail,
} from '@/core/trails/trails';
import { mapColors } from '@/ui/theme';

// Where the layers go in the style (design/style-carte.md, "Circuits
// balisés"): the line before the first name layer (above the roads), the
// name before the names of places. The route and the markers are declared
// after, so they stay on top.
export const TRAILS_LINE_BEFORE = 'cote';
export const TRAILS_NAME_BEFORE = 'lieu-hameau';

// 44 x 44 dp around the finger, written here: measured in the essay of the
// phase 7, not left to the default of the library (ADR 0020, section 9).
const HITBOX = { top: 22, right: 22, bottom: 22, left: 22 } as const;

const NOT_EMPTY = ['!=', ['get', 'label'], ''] as never;

// The line: 1.5 at zoom 8, 2.5 at zoom 10, 6 at zoom 15, 8.5 at zoom 18.
const LINE_WIDTH = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  1.5,
  10,
  2.5,
  12,
  3.6,
  15,
  6,
  17,
  7.8,
  18,
  8.5,
] as never;

const TEXT_SIZE = [
  'interpolate',
  ['linear'],
  ['zoom'],
  12,
  11,
  15,
  13,
  18,
  15,
] as never;

type Press = NonNullable<ComponentProps<typeof GeoJSONSource>['onPress']>;

/**
 * The circuits as a thick blue line with their name along it. Always
 * mounted, empty while the file is read. `onPress` is given on the map tab
 * only: in the creation, a touch must put a point, so nothing is wired.
 */
export const TrailsLayer = memo(function TrailsLayer({
  trails,
  onPress,
  chosen = null,
}: {
  trails: Trail[] | undefined;
  onPress?: Press;
  /** The circuit of the open sheet: full line, arrows; the others fade. */
  chosen?: Trail | null;
}) {
  const data = useMemo(() => trailsToMapData(trails ?? []), [trails]);
  const chosenData = useMemo(() => chosenToMapData(chosen), [chosen]);
  const chevrons = useMemo(() => chevronsToMapData(chosen), [chosen]);
  return (
    <>
      <GeoJSONSource
        id="circuits"
        data={data}
        onPress={onPress}
        hitbox={onPress ? HITBOX : undefined}
      >
        <Layer
          id="circuit"
          type="line"
          beforeId={TRAILS_LINE_BEFORE}
          minzoom={8}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': mapColors.circuit,
            'line-opacity': chosen ? 0.25 : 0.55,
            'line-width': LINE_WIDTH,
          }}
        />
        <Layer
          id="nom-circuit"
          type="symbol"
          beforeId={TRAILS_NAME_BEFORE}
          minzoom={12}
          filter={NOT_EMPTY}
          layout={{
            'symbol-placement': 'line',
            'symbol-spacing': 300,
            'text-max-angle': 30,
            'text-field': ['get', 'label'],
            'text-font': ['NotoSans-Bold'],
            'text-size': TEXT_SIZE,
          }}
          paint={{
            'text-color': mapColors.circuitText,
            'text-halo-color': mapColors.labelHalo,
            'text-halo-width': 2,
          }}
        />
      </GeoJSONSource>
      {/* Always mounted, empty when nothing is chosen (iOS and `beforeId`). */}
      <GeoJSONSource id="circuit-choisi" data={chosenData}>
        <Layer
          id="circuit-choisi-lisere"
          type="line"
          beforeId={TRAILS_LINE_BEFORE}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': mapColors.circuitArrow, 'line-width': 12 }}
        />
        <Layer
          id="circuit-choisi"
          type="line"
          beforeId={TRAILS_LINE_BEFORE}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': mapColors.circuit, 'line-width': 8 }}
        />
      </GeoJSONSource>
      {/* The direction: white chevrons, points with a bearing, one set per zoom band. */}
      <GeoJSONSource id="circuit-sens-points" data={chevrons}>
        {CHEVRON_BANDS.map((band, index) => (
          <Layer
            key={band.minZoom}
            id={`circuit-sens-${index}`}
            type="symbol"
            beforeId={TRAILS_NAME_BEFORE}
            minzoom={band.minZoom}
            maxzoom={band.maxZoom}
            filter={['==', ['get', 'band'], index] as never}
            layout={{
              'symbol-placement': 'point',
              'text-field': '>',
              'text-font': ['NotoSans-Bold'],
              'text-size': 16,
              'text-rotate': ['get', 'rotate'] as never,
              'text-rotation-alignment': 'map',
              'text-pitch-alignment': 'map',
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{ 'text-color': mapColors.circuitArrow }}
          />
        ))}
      </GeoJSONSource>
    </>
  );
});
