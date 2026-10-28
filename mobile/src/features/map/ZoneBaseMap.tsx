import {
  Camera,
  Map,
  type CameraRef,
  type MapProps,
} from '@maplibre/maplibre-react-native';
import { useMemo, type ReactNode, type Ref } from 'react';
import { StyleSheet } from 'react-native';

import type { Zone } from '@/core/zones/catalogue';
import { zoneFileUri } from '@/shared-data/zones/zoneFileUri';

import { buildMapStyle, MAX_ZOOM, MIN_ZOOM } from './mapStyle';
import { glyphsDirUri } from './useGlyphsReady';

/** Where the camera opens: the whole zone, or a given center and zoom. */
export type OpeningView = { center: [number, number]; zoom: number };

/**
 * The map background shared by the map tab and the creation screen: style
 * (files of the zone, glyphs, veil outside the zone) and camera limits.
 * The glyphs must already be on the disk.
 */
export function ZoneBaseMap({
  zone,
  cameraRef,
  opening,
  onPress,
  onRegionDidChange,
  children,
}: {
  zone: Zone;
  cameraRef: Ref<CameraRef>;
  opening?: OpeningView;
  onPress?: MapProps['onPress'];
  onRegionDidChange?: MapProps['onRegionDidChange'];
  children?: ReactNode;
}) {
  const style = useMemo(
    () =>
      buildMapStyle({
        files: {
          map: zoneFileUri(zone, 'map.pmtiles'),
          terrain: zoneFileUri(zone, 'terrain.pmtiles'),
          contours: zoneFileUri(zone, 'contours.pmtiles'),
        },
        glyphsDir: glyphsDirUri(),
        bbox: zone.bbox,
      }),
    [zone],
  );
  const { lonMin, latMin, lonMax, latMax } = zone.bbox;
  return (
    <Map
      style={styles.map}
      mapStyle={style}
      attribution={false}
      logo={false}
      compass={false}
      touchRotate={false}
      touchPitch={false}
      onPress={onPress}
      onRegionDidChange={onRegionDidChange}
    >
      <Camera
        ref={cameraRef}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={[lonMin, latMin, lonMax, latMax]}
        initialViewState={
          opening ?? {
            bounds: [lonMin, latMin, lonMax, latMax],
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          }
        }
      />
      {children}
    </Map>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
