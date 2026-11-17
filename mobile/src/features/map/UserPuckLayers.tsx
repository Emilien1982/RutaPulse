import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';

import type { PuckFeature } from '@/core/position/userPuck';
import { mapColors, navColors } from '@/ui/theme';

// The arrow of the dot: 40 by 40 points, pointing north (design/tokens.md).
const IMAGES = {
  'fleche-cap': require('../../../assets/images/fleche-cap.png') as number,
};

const HALO_COLOR = '#1A73E8';
const NO_POINT = { type: 'FeatureCollection' as const, features: [] };

/**
 * The dot of the user, inside the map: accuracy halo, shadow, round, and the
 * arrow of the heading (ADR 0021, section 9.1). Our own layers, above all
 * the others: the map tab and the creation draw it at size 13 (32 in all),
 * the tracking at size 17 (40) with an arrow of scale 1. `lost`: grey, no
 * arrow. A missing `heading` hides the arrow, a missing `r0` the halo.
 */
export function UserPuckLayers({
  feature,
  size = 'map',
  lost = false,
}: {
  feature: PuckFeature | null;
  size?: 'map' | 'tracking';
  lost?: boolean;
}) {
  const radius = size === 'tracking' ? 17 : 13;
  return (
    <>
      <Images images={IMAGES} />
      <GeoJSONSource id="position" data={feature ?? NO_POINT}>
        <Layer
          id="position-halo"
          type="circle"
          filter={['has', 'r0']}
          paint={{
            'circle-color': HALO_COLOR,
            'circle-opacity': 0.16,
            'circle-stroke-width': 1,
            'circle-stroke-color': HALO_COLOR,
            'circle-stroke-opacity': 0.4,
            // The exact radius: the accuracy, doubled at each zoom.
            'circle-radius': [
              'interpolate',
              ['exponential', 2],
              ['zoom'],
              0,
              ['get', 'r0'],
              22,
              ['*', ['get', 'r0'], 4194304],
            ] as never,
          }}
        />
        <Layer
          id="position-ombre"
          type="circle"
          paint={{
            'circle-radius': radius + 3,
            'circle-color': '#000000',
            'circle-opacity': 0.25,
            'circle-blur': 0.5,
            'circle-translate': [0, 2],
          }}
        />
        <Layer
          id="position-rond"
          type="circle"
          paint={{
            'circle-radius': radius,
            'circle-color': lost ? navColors.lostPosition : mapColors.position,
            'circle-stroke-width': 3,
            'circle-stroke-color': mapColors.positionBorder,
          }}
        />
        <Layer
          id="position-fleche"
          type="symbol"
          filter={lost ? (['boolean', false] as never) : ['has', 'heading']}
          layout={{
            'icon-image': 'fleche-cap',
            'icon-size': size === 'tracking' ? 1 : 0.8,
            'icon-rotate': ['get', 'heading'] as never,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
