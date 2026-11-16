import {
  useCurrentPosition,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Alert, AppState, Linking, StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n/t';
import {
  nextHeading,
  puckFeature,
  type HeadingState,
} from '@/core/position/userPuck';
import { clampToBbox } from '@/core/zones/activeZone';
import type { Zone } from '@/core/zones/catalogue';
import { FloatingButton } from '@/ui/FloatingButton';
import { LocateIcon, LocateOffIcon } from '@/ui/icons';
import { spacing } from '@/ui/theme';

export const RECENTER_ZOOM = 15;
// The camera keeps its padding: every move says it, so that the margin of the
// error sheet never stays after it is gone.
export const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * The box "Position désactivée": the way to the settings of the phone. Shared
 * with the start of the tracking, which gives its own message.
 */
export function alertLocationOff(message: string = t('map.locationOffText')) {
  Alert.alert(t('map.locationOffTitle'), message, [
    { text: t('map.locationOffCancel'), style: 'cancel' },
    {
      text: t('map.locationOffSettings'),
      onPress: () => void Linking.openSettings(),
    },
  ]);
}

/**
 * The position of the user on a zone map: permission "while using the app",
 * the GPS position, and the recentering. Shared by the map tab and the
 * creation screen (mockups 90 and 10). `zoom` holds the zoom of the map.
 */
export function useMapPosition(
  zone: Zone,
  camera: RefObject<CameraRef | null>,
  zoom: RefObject<number>,
  // Called when the user allows the position (answer of the request, or back
  // from the settings of the phone), not when it was already allowed.
  onAllowed?: () => void,
) {
  const [granted, setGranted] = useState(false);
  // False until the first answer to the permission: the button is not crossed
  // out before the phone has answered.
  const [answered, setAnswered] = useState(false);
  const canAskAgain = useRef(true);
  const allowed = useRef(onAllowed);
  useEffect(() => {
    allowed.current = onAllowed;
  });
  const position = useCurrentPosition({ enabled: granted });

  // Permission "while using the app" only.
  useEffect(() => {
    let active = true;
    void Location.requestForegroundPermissionsAsync().then((result) => {
      if (!active) return;
      canAskAgain.current = result.canAskAgain;
      setGranted(result.granted);
      setAnswered(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Back from the settings of the phone: read the permission again. Only once
  // the first request is answered: the box of that request also brings the
  // app back to "active", and its answer is not a "follow" (ADR 0021, 9.4).
  useEffect(() => {
    if (granted || !answered) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void Location.getForegroundPermissionsAsync().then((result) => {
        canAskAgain.current = result.canAskAgain;
        setGranted(result.granted);
        if (result.granted) allowed.current?.();
      });
    });
    return () => subscription.remove();
  }, [granted, answered]);

  const lon = position?.coords.longitude;
  const lat = position?.coords.latitude;
  const accuracy = position?.coords.accuracy;
  const course = position?.coords.heading;
  const speed = position?.coords.speed;
  const fixAt = position?.timestamp;

  // The heading of the arrow, one step per position (not per redraw).
  const [arrow, setArrow] = useState<HeadingState>({
    heading: null,
    slowSince: null,
  });
  const [lastFix, setLastFix] = useState('');
  const fixKey = `${lon}/${lat}/${course}/${speed}/${fixAt}`;
  if (lon !== undefined && fixKey !== lastFix) {
    setLastFix(fixKey);
    setArrow(
      nextHeading(
        arrow,
        { heading: course ?? null, speed: speed ?? null },
        fixAt ?? 0,
      ),
    );
  }
  const feature = useMemo(
    () =>
      lon !== undefined && lat !== undefined
        ? puckFeature(
            { longitude: lon, latitude: lat, accuracy },
            arrow.heading,
          )
        : null,
    [lon, lat, accuracy, arrow.heading],
  );

  function askForPermission() {
    if (!canAskAgain.current) {
      alertLocationOff();
      return;
    }
    void Location.requestForegroundPermissionsAsync().then((result) => {
      canAskAgain.current = result.canAskAgain;
      setGranted(result.granted);
      if (result.granted) allowed.current?.();
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

  return { granted, answered, lon, lat, feature, askForPermission, recenter };
}

// The three states of the button (mockup 90): the position is refused, at
// rest, or the map follows the position (the creation has no "follow").
export type RecenterState = 'refused' | 'rest' | 'follow';

// "Ma position" (mockup 10: 64 under the top bar; mockup 90: 60 from the top).
export function RecenterButton({
  state,
  top,
  onPress,
}: {
  state: RecenterState;
  top: number;
  onPress: () => void;
}) {
  const refused = state === 'refused';
  return (
    <View style={[styles.button, { top }]}>
      <FloatingButton
        accessibilityLabel={t(
          refused
            ? 'map.recenterRefused'
            : state === 'follow'
              ? 'map.recenterFollowing'
              : 'map.recenter',
        )}
        accessibilityHint={refused ? t('map.recenterRefusedHint') : undefined}
        active={state === 'follow'}
        onPress={onPress}
        icon={(color) =>
          refused ? (
            <LocateOffIcon color={color} />
          ) : (
            <LocateIcon color={color} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { position: 'absolute', right: spacing.s4 },
});
