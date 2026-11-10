import {
  Camera,
  Map,
  type CameraRef,
  type MapProps,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { useMemo, type ReactNode, type Ref } from 'react';
import { StyleSheet } from 'react-native';

import type { Zone } from '@/core/zones/catalogue';
import { zoneFileUri } from '@/shared-data/zones/zoneFileUri';

import { buildMapStyle, MAX_ZOOM, MIN_ZOOM } from './mapStyle';
import { glyphsDirUri } from './useGlyphsReady';

/** Where the camera opens: the whole zone, or a given center and zoom. */
export type OpeningView = {
  center: [number, number];
  zoom: number;
  padding?: { top: number; right: number; bottom: number; left: number };
};

/** The map opens on this box: [west, south, east, north] and a padding. */
export type OpeningBounds = {
  bounds: [number, number, number, number];
  padding: { top: number; right: number; bottom: number; left: number };
};

/**
 * The map background shared by the map tab and the creation screen: style
 * (files of the zone, glyphs, veil outside the zone) and camera limits.
 * The glyphs must already be on the disk.
 */
export function ZoneBaseMap({
  zone,
  cameraRef,
  mapRef,
  opening,
  fit,
  labels,
  onPress,
  onRegionDidChange,
  onDidFinishLoadingMap,
  children,
}: {
  zone: Zone;
  cameraRef: Ref<CameraRef>;
  mapRef?: Ref<MapRef>;
  opening?: OpeningView;
  /** A map that does not move, opened on a box (Infos screen). */
  fit?: OpeningBounds;
  /** False hides the names of places (small map of the Infos screen). */
  labels?: boolean;
  onPress?: MapProps['onPress'];
  onRegionDidChange?: MapProps['onRegionDidChange'];
  onDidFinishLoadingMap?: MapProps['onDidFinishLoadingMap'];
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
        labels,
      }),
    [zone, labels],
  );
  const { lonMin, latMin, lonMax, latMax } = zone.bbox;
  return (
    <Map
      ref={mapRef}
      style={styles.map}
      mapStyle={style}
      attribution={false}
      logo={false}
      compass={false}
      touchRotate={false}
      touchPitch={false}
      dragPan={!fit}
      touchZoom={!fit}
      doubleTapZoom={!fit}
      doubleTapHoldZoom={!fit}
      onPress={onPress}
      onRegionDidChange={onRegionDidChange}
      onDidFinishLoadingMap={onDidFinishLoadingMap}
    >
      <Camera
        ref={cameraRef}
        // A map opened on a box must be free to zoom out to the whole route.
        minZoom={fit ? 0 : MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={fit ? undefined : [lonMin, latMin, lonMax, latMax]}
        initialViewState={
          fit ??
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
