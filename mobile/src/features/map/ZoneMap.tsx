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
import { Alert, AppState, Linking, StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import type { Zone } from '@/core/zones/catalogue';
import { clampToBbox, isInsideBbox } from '@/core/zones/activeZone';
import { Button } from '@/ui/Button';
import { zoneFileUri } from '@/shared-data/zones/zoneFileUri';
import { FloatingButton } from '@/ui/FloatingButton';
import { LocateIcon, LocateOffIcon } from '@/ui/icons';
import { border, colors, mapColors, radius, spacing, text } from '@/ui/theme';

import { buildMapStyle, MAX_ZOOM, MIN_ZOOM } from './mapStyle';
import { RouteLayer } from './RouteLayer';
import {
  RouteBubble,
  RouteErrorSheet,
  RouteSummarySheet,
  RouteTopBar,
} from './RouteSheets';
import { glyphsDirUri } from './useGlyphsReady';
import { useRouteCreation } from './useRouteCreation';

const RECENTER_ZOOM = 15;
// First position inside the zone: the map opens on it, at this zoom.
const OPEN_ZOOM = 14;

// The map of a ready zone (mockup 90). The glyphs must already be on the disk.
export function ZoneMap({ zone }: { zone: Zone }) {
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(RECENTER_ZOOM);
  const [granted, setGranted] = useState(false);
  const canAskAgain = useRef(true);
  const touched = useRef(false);
  const opened = useRef(false);
  const position = useCurrentPosition({ enabled: granted });
  const creation = useRouteCreation(zone.bbox);
  const { state: route } = creation;
  // Height of the top bar of the creation, measured by the bar itself.
  const [barHeight, setBarHeight] = useState(112);
  const topOffset = route.creating ? barHeight + spacing.s4 : 60;

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
      if (!active) return;
      canAskAgain.current = result.canAskAgain;
      setGranted(result.granted);
    });
    return () => {
      active = false;
    };
  }, []);

  // Back from the settings of the phone: read the permission again.
  useEffect(() => {
    if (granted) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void Location.getForegroundPermissionsAsync().then((result) => {
        canAskAgain.current = result.canAskAgain;
        setGranted(result.granted);
      });
    });
    return () => subscription.remove();
  }, [granted]);

  const lon = position?.coords.longitude;
  const lat = position?.coords.latitude;
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
      duration: 300,
    });
  }, [lon, lat, zone.bbox]);

  // The error sheet covers the lower half: the refused point goes to the
  // center of the map, which stays above the sheet.
  const problemPoint = route.problem?.point;
  useEffect(() => {
    if (!problemPoint) return;
    camera.current?.easeTo({
      center: [problemPoint.lon, problemPoint.lat],
      duration: 300,
    });
  }, [problemPoint]);

  function askForPermission() {
    if (!canAskAgain.current) {
      Alert.alert(t('map.locationOffTitle'), t('map.locationOffText'), [
        { text: t('map.locationOffCancel'), style: 'cancel' },
        {
          text: t('map.locationOffSettings'),
          onPress: () => void Linking.openSettings(),
        },
      ]);
      return;
    }
    void Location.requestForegroundPermissionsAsync().then((result) => {
      canAskAgain.current = result.canAskAgain;
      setGranted(result.granted);
    });
  }

  function recenter() {
    if (!granted) {
      askForPermission();
      return;
    }
    if (lon === undefined || lat === undefined) return;
    // Out of the zone, the map goes to the closest point of the zone.
    camera.current?.easeTo({
      center: clampToBbox(zone.bbox, lon, lat),
      zoom: Math.max(zoom.current, RECENTER_ZOOM),
      duration: 500,
    });
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
        onPress={(e) => {
          const [lon, lat] = e.nativeEvent.lngLat;
          creation.touch({ lon, lat });
        }}
        onRegionDidChange={(e) => {
          zoom.current = e.nativeEvent.zoom;
          if (e.nativeEvent.userInteraction) touched.current = true;
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
        {route.creating && <RouteLayer state={route} />}
      </Map>

      <View style={[styles.button, { top: topOffset }]}>
        <FloatingButton
          accessibilityLabel={t('map.recenter')}
          onPress={recenter}
          icon={(color) =>
            granted ? (
              <LocateIcon color={color} />
            ) : (
              <LocateOffIcon color={color} />
            )
          }
        />
      </View>

      {outside && (
        <View
          accessibilityRole="alert"
          style={[styles.notice, { top: topOffset }]}
        >
          <Text style={text.secondary}>{t('map.outsideZone')}</Text>
        </View>
      )}

      {route.creating && (
        <>
          <RouteTopBar onClose={creation.close} onHeight={setBarHeight} />
          {route.computing ? (
            <RouteBubble
              top={barHeight + spacing.s3}
              testID="route-computing"
              label={t('route.computing')}
            />
          ) : (
            !route.problem &&
            !route.route && (
              <RouteBubble
                top={barHeight + spacing.s3}
                testID="route-hint"
                label={t(route.start ? 'route.hintEnd' : 'route.hintStart')}
              />
            )
          )}
        </>
      )}

      <View style={styles.bottom} pointerEvents="box-none">
        {!route.creating && (
          <View style={styles.newRoute}>
            <Button
              testID="new-route-button"
              variant="secondary"
              label={t('route.new')}
              accessibilityLabel={t('route.newLabel')}
              onPress={creation.open}
            />
          </View>
        )}
        <View style={styles.attribution} pointerEvents="none">
          <Text style={text.attribution}>{t('map.attribution')}</Text>
        </View>
        {route.problem ? (
          <RouteErrorSheet
            kind={route.problem.kind}
            onRemove={creation.removeProblemPoint}
          />
        ) : (
          route.route && (
            <RouteSummarySheet
              distanceKm={route.route.distanceKm}
              durationS={route.route.durationS}
            />
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  map: { flex: 1 },
  button: { position: 'absolute', right: spacing.s4 },
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
  newRoute: { alignSelf: 'center', marginBottom: spacing.s3 },
  attribution: {
    alignSelf: 'flex-start',
    marginLeft: spacing.s2,
    marginBottom: spacing.s2,
    backgroundColor: mapColors.attributionBackground,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
});
