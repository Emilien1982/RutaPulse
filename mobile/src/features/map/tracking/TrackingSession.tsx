// The tracking while it runs (ADR 0021, section 5): the Store, the GPS, the
// background pause, the screen kept awake, "Terminer" and the way back.

import { useSelector } from '@tanstack/react-store';
import { useKeepAwake } from 'expo-keep-awake';
import { usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { t } from '@/core/i18n/t';
import type { ClimbProfile } from '@/core/tracking/remaining';
import { remainingClimbM } from '@/core/tracking/remaining';
import type { Fix } from '@/core/tracking/placement';
import type { TrackingSource } from '@/core/tracking/trackingLine';
import {
  formatClimbLeft,
  formatRemaining,
  panelOf,
  remainingOf,
} from '@/core/tracking/trackingState';
import type { Zone } from '@/core/zones/catalogue';
import { navColors } from '@/ui/theme';

import { GuidancePanel } from './GuidancePanel';
import { RideEnd } from './RideEnd';
import { TrackingFooter } from './TrackingFooter';
import { TrackingMap } from './TrackingMap';
import { createTrackingStore, type TrackingStore } from './trackingStore';
import { useDirections } from './useDirections';
import { useGpsFixes } from './useGpsFixes';

/** "Terminer" before this distance ridden (m): back to the Infos screen. */
export const MIN_RIDE_M = 100;

export function TrackingSession({
  source,
  climb,
  zone,
}: {
  source: TrackingSource;
  /** The ascent along the route; null: unknown ("—"). */
  climb: ClimbProfile | null;
  /** The zone drawn as the map; null: a plain background. */
  zone: Zone | null;
}) {
  const router = useRouter();
  const [{ store, dispatch }] = useState<TrackingStore>(() =>
    createTrackingStore(source, Date.now()),
  );
  const status = useSelector(store, (s) => s.status);
  const end = useSelector(store, (s) => s.end);

  useDirections(source, dispatch);
  // The GPS is on while tracking: off in the background and after the end.
  const onFix = useCallback(
    (fix: Fix) => dispatch({ type: 'fix', fix }),
    [dispatch],
  );
  useGpsFixes(status === 'tracking', onFix);

  useEffect(() => {
    if (status === 'ended') return;
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'background') dispatch({ type: 'pause', at: Date.now() });
      else if (state === 'active') dispatch({ type: 'resume', at: Date.now() });
    });
    const tick = setInterval(
      () => dispatch({ type: 'tick', at: Date.now() }),
      1000,
    );
    return () => {
      app.remove();
      clearInterval(tick);
    };
  }, [status, dispatch]);

  // One box for the button and for the way back of the system (C7).
  const askFinish = useCallback(() => {
    Alert.alert(
      t('tracking.finishTitle'),
      t('tracking.finishText'),
      [
        { text: t('tracking.continue'), style: 'cancel' },
        {
          text: t('tracking.finish'),
          style: 'destructive',
          onPress: () => dispatch({ type: 'finish', at: Date.now() }),
        },
        // Android: touching outside or the way back is "Continuer" (mockup 30).
      ],
      { cancelable: true },
    );
  }, [dispatch]);
  usePreventRemove(status !== 'ended', askFinish);

  // Under 100 m ridden, no summary: back to the Infos screen.
  useEffect(() => {
    if (
      status === 'ended' &&
      end === 'finished' &&
      store.state.ride.distanceM < MIN_RIDE_M
    ) {
      router.back();
    }
  }, [status, end, store, router]);

  if (status === 'ended') {
    return end === 'finished' && store.state.ride.distanceM < MIN_RIDE_M ? (
      <View style={styles.screen} />
    ) : (
      <RideEnd arrived={end === 'arrived'} onClose={() => router.back()} />
    );
  }
  return (
    <ActiveTracking
      store={store}
      source={source}
      climb={climb}
      zone={zone}
      onFinish={askFinish}
    />
  );
}

// The screen while tracking. The screen is kept awake as long as it is
// mounted, so only during the tracking (C8).
function ActiveTracking({
  store,
  source,
  climb,
  zone,
  onFinish,
}: {
  store: TrackingStore['store'];
  source: TrackingSource;
  climb: ClimbProfile | null;
  zone: Zone | null;
  onFinish: () => void;
}) {
  useKeepAwake('tracking');
  const panel = useSelector(store, panelOf, { compare: shallowEqual });
  const remaining = useSelector(store, (s) => formatRemaining(remainingOf(s)));
  const climbLeft = useSelector(store, (s) =>
    formatClimbLeft(remainingClimbM(climb, s.line, s.placement)),
  );
  return (
    <View style={styles.screen}>
      <GuidancePanel panel={panel} />
      <TrackingMap
        zone={zone}
        store={store}
        source={source}
        bottom={
          <Pressable
            testID="tracking-finish"
            accessibilityRole="button"
            onPress={onFinish}
            style={styles.finish}
          >
            <Text style={styles.finishText} maxFontSizeMultiplier={1.2}>
              {t('tracking.finish')}
            </Text>
          </Pressable>
        }
      />
      <TrackingFooter remaining={remaining} climbLeft={climbLeft} />
    </View>
  );
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return keys.every((key) => Object.is(a[key], b[key]));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: navColors.background },
  finish: {
    width: 140,
    height: 64,
    borderRadius: 32,
    backgroundColor: navColors.background,
    borderWidth: 2,
    borderColor: navColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  finishText: { fontSize: 20, fontWeight: '700', color: navColors.danger },
});
