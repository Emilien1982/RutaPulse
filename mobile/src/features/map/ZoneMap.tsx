import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import type { Zone } from '@/core/zones/catalogue';
import { isInsideBbox } from '@/core/zones/activeZone';
import { Button } from '@/ui/Button';
import { PlusIcon } from '@/ui/icons';
import {
  border,
  colors,
  mapColors,
  radius,
  shadow,
  spacing,
  text,
} from '@/ui/theme';

import {
  NO_PADDING,
  RECENTER_ZOOM,
  RecenterButton,
  UserPositionLayers,
  useMapPosition,
} from './MapPosition';
import { ZoneBaseMap } from './ZoneBaseMap';

// First position inside the zone: the map opens on it, at this zoom.
const OPEN_ZOOM = 14;

// The map of a ready zone (mockup 90). The glyphs must already be on the disk.
export function ZoneMap({ zone }: { zone: Zone }) {
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(RECENTER_ZOOM);
  const touched = useRef(false);
  const opened = useRef(false);
  const { granted, lon, lat, recenter } = useMapPosition(zone, camera, zoom);
  const router = useRouter();
  // Where the user left the map: the creation opens on the same view.
  const view = useRef<{ lon: number; lat: number; zoom: number } | null>(null);
  const outside =
    lon !== undefined && lat !== undefined
      ? !isInsideBbox(zone.bbox, lon, lat)
      : false;

  // At opening: on the first position if it is in the zone and the map has
  // not been touched. Otherwise the whole zone stays on screen.
  useEffect(() => {
    if (opened.current || lon === undefined || lat === undefined) return;
    opened.current = true;
    if (touched.current || !isInsideBbox(zone.bbox, lon, lat)) return;
    camera.current?.easeTo({
      center: [lon, lat],
      zoom: OPEN_ZOOM,
      padding: NO_PADDING,
      duration: 300,
    });
  }, [lon, lat, zone.bbox]);

  function openCreation() {
    const at = view.current;
    router.push({
      pathname: '/draft',
      params: at
        ? { lon: String(at.lon), lat: String(at.lat), zoom: String(at.zoom) }
        : {},
    });
  }

  return (
    <View
      style={styles.screen}
      accessibilityLabel={t('map.label', { name: zone.name })}
    >
      <ZoneBaseMap
        zone={zone}
        cameraRef={camera}
        onRegionDidChange={(e) => {
          const { center, zoom: z, userInteraction } = e.nativeEvent;
          zoom.current = z;
          if (center)
            view.current = { lon: center[0], lat: center[1], zoom: z };
          if (userInteraction) touched.current = true;
        }}
      >
        <UserPositionLayers granted={granted} />
      </ZoneBaseMap>

      <RecenterButton granted={granted} top={60} onPress={recenter} />

      {outside && (
        <View accessibilityRole="alert" style={[styles.notice, { top: 60 }]}>
          <Text style={text.secondary}>{t('map.outsideZone')}</Text>
        </View>
      )}

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.newRoute}>
          <Button
            testID="new-route-button"
            variant="secondary"
            label={t('route.new')}
            accessibilityLabel={t('route.newLabel')}
            icon={(color) => <PlusIcon color={color} />}
            onPress={openCreation}
          />
        </View>
        <View style={styles.attribution} pointerEvents="none">
          <Text style={text.attribution}>{t('map.attribution')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  notice: {
    position: 'absolute',
    left: spacing.s4,
    right: 80,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.box,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s3,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  newRoute: {
    alignSelf: 'center',
    marginBottom: spacing.s3,
    borderRadius: radius.button56,
    backgroundColor: colors.creamLight,
    ...shadow,
  },
  attribution: {
    alignSelf: 'flex-start',
    marginLeft: spacing.s2,
    marginBottom: spacing.s2,
    backgroundColor: mapColors.attributionBackground,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
});
