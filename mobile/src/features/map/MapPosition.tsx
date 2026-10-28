import {
  Layer,
  UserLocation,
  useCurrentPosition,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Alert, AppState, Linking, StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n/t';
import { clampToBbox } from '@/core/zones/activeZone';
import type { Zone } from '@/core/zones/catalogue';
import { FloatingButton } from '@/ui/FloatingButton';
import { LocateIcon, LocateOffIcon } from '@/ui/icons';
import { mapColors, spacing } from '@/ui/theme';

export const RECENTER_ZOOM = 15;
// The camera keeps its padding: every move says it, so that the margin of the
// error sheet never stays after it is gone.
export const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * The position of the user on a zone map: permission "while using the app",
 * the GPS position, and the recentering. Shared by the map tab and the
 * creation screen (mockups 90 and 10). `zoom` holds the zoom of the map.
 */
export function useMapPosition(
  zone: Zone,
  camera: RefObject<CameraRef | null>,
  zoom: RefObject<number>,
) {
  const [granted, setGranted] = useState(false);
  const canAskAgain = useRef(true);
  const position = useCurrentPosition({ enabled: granted });

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
      padding: NO_PADDING,
      duration: 500,
    });
  }

  return { granted, lon, lat, recenter };
}

// The blue dot, inside the map. Drawn above the layers declared before it.
export function UserPositionLayers({ granted }: { granted: boolean }) {
  if (!granted) return null;
  return (
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
        paint={{ 'circle-radius': 13, 'circle-color': mapColors.position }}
      />
    </UserLocation>
  );
}

// "Ma position" (mockup 10: 64 under the top bar; mockup 90: 60 from the top).
export function RecenterButton({
  granted,
  top,
  onPress,
}: {
  granted: boolean;
  top: number;
  onPress: () => void;
}) {
  return (
    <View style={[styles.button, { top }]}>
      <FloatingButton
        accessibilityLabel={t('map.recenter')}
        onPress={onPress}
        icon={(color) =>
          granted ? (
            <LocateIcon color={color} />
          ) : (
            <LocateOffIcon color={color} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { position: 'absolute', right: spacing.s4 },
});
