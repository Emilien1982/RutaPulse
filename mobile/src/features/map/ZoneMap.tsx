import {
  Camera,
  Layer,
  Map,
  UserLocation,
  useCurrentPosition,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import type { Zone } from '@/core/zones/catalogue';
import { clampToBbox, isInsideBbox } from '@/core/zones/activeZone';
import { zoneFileUri } from '@/shared-data/zones/zoneFileUri';
import { FloatingButton } from '@/ui/FloatingButton';
import { LocateIcon } from '@/ui/icons';
import { border, colors, mapColors, radius, spacing, text } from '@/ui/theme';

import { buildMapStyle, MAX_ZOOM, MIN_ZOOM } from './mapStyle';
import { glyphsDirUri } from './useGlyphsReady';

const RECENTER_ZOOM = 15;
const NOTICE_MS = 5000;

// The map of a ready zone (mockup 90). The glyphs must already be on the disk.
export function ZoneMap({ zone }: { zone: Zone }) {
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(RECENTER_ZOOM);
  const [granted, setGranted] = useState(false);
  const [notice, setNotice] = useState(false);
  const position = useCurrentPosition({ enabled: granted });

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

  // Permission "while using the app" only.
  useEffect(() => {
    let active = true;
    void Location.requestForegroundPermissionsAsync().then((result) => {
      if (active) setGranted(result.granted);
    });
    return () => {
      active = false;
    };
  }, []);

  const lon = position?.coords.longitude;
  const lat = position?.coords.latitude;
  const outside =
    lon !== undefined && lat !== undefined
      ? !isInsideBbox(zone.bbox, lon, lat)
      : false;

  // The notice goes away after a few seconds, or when back in the zone.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  function recenter() {
    if (lon === undefined || lat === undefined) return;
    // Out of the zone, the map goes to the closest point of the zone.
    camera.current?.easeTo({
      center: clampToBbox(zone.bbox, lon, lat),
      zoom: Math.max(zoom.current, RECENTER_ZOOM),
      duration: 500,
    });
    setNotice(outside);
  }

  const { lonMin, latMin, lonMax, latMax } = zone.bbox;

  return (
    <View
      style={styles.screen}
      accessibilityLabel={t('map.label', { name: zone.name })}
    >
      <Map
        style={styles.map}
        mapStyle={style}
        attribution={false}
        logo={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        onRegionDidChange={(e) => {
          zoom.current = e.nativeEvent.zoom;
        }}
      >
        <Camera
          ref={camera}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          maxBounds={[lonMin, latMin, lonMax, latMax]}
          initialViewState={{
            bounds: [lonMin, latMin, lonMax, latMax],
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          }}
        />
        {granted && (
          <UserLocation animated={false}>
            <Layer
              type="circle"
              id="position-bord"
              source="mlrn-user-location"
              paint={{
                'circle-radius': 16,
                'circle-color': mapColors.positionBorder,
              }}
            />
            <Layer
              type="circle"
              id="position"
              source="mlrn-user-location"
              paint={{
                'circle-radius': 13,
                'circle-color': mapColors.position,
              }}
            />
          </UserLocation>
        )}
      </Map>

      <View style={styles.button}>
        <FloatingButton
          accessibilityLabel={t('map.recenter')}
          onPress={recenter}
          icon={(color) => <LocateIcon color={color} />}
        />
      </View>

      {notice && outside && (
        <View accessibilityRole="alert" style={styles.notice}>
          <Text style={text.secondary}>{t('map.outsideZone')}</Text>
        </View>
      )}

      <View style={styles.attribution} pointerEvents="none">
        <Text style={text.attribution}>{t('map.attribution')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  map: { flex: 1 },
  button: { position: 'absolute', top: 60, right: spacing.s4 },
  notice: {
    position: 'absolute',
    top: 60,
    left: spacing.s4,
    right: 80,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.box,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s3,
  },
  attribution: {
    position: 'absolute',
    left: spacing.s2,
    bottom: spacing.s2,
    backgroundColor: mapColors.attributionBackground,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
});
