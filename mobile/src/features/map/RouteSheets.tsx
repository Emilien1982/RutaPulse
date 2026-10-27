import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import type { TextKey } from '@/core/i18n/fr';
import { t } from '@/core/i18n/t';
import { formatDistance, formatDuration } from '@/core/routing/formatRoute';
import type { RouteErrorKind } from '@/core/routing/routeResponse';
import { Button } from '@/ui/Button';
import { CyclistScene } from '@/ui/Cyclist';
import { CloseIcon } from '@/ui/icons';
import { Stripes } from '@/ui/Stripes';
import {
  border,
  colors,
  radius,
  shadow,
  spacing,
  target,
  text,
} from '@/ui/theme';

// Top bar of the creation (mockup 10): cream, title, a way out, 3 stripes.
export function RouteTopBar({
  onClose,
  onHeight,
}: {
  onClose: () => void;
  onHeight: (height: number) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.topBar, { paddingTop: insets.top }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      <View style={styles.topRow}>
        <Pressable
          testID="route-close"
          accessibilityRole="button"
          accessibilityLabel={t('route.close')}
          onPress={onClose}
          style={styles.closeButton}
        >
          <CloseIcon color={colors.brown} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.topTitle}>
          {t('route.new')}
        </Text>
      </View>
      <Stripes />
    </View>
  );
}

// Small dark pill under the bar (the "bulle" of the mockup): what to touch,
// or the wait while the engine computes.
export function RouteBubble({
  top,
  label,
  testID,
}: {
  top: number;
  label: string;
  testID: string;
}) {
  return (
    <View style={[styles.bubbleRow, { top }]} pointerEvents="none">
      <View testID={testID} accessibilityRole="alert" style={styles.bubble}>
        <Text style={styles.bubbleText}>{label}</Text>
      </View>
    </View>
  );
}

// Digits big, the rest (unit) smaller: "25,1" + " km", "1" + " h " + "35".
function Figure({
  value,
  label,
  testID,
}: {
  value: string;
  label: string;
  testID: string;
}) {
  const parts = value.split(/(\d+(?:,\d+)?)/).filter(Boolean);
  return (
    <View style={styles.figure}>
      <Text testID={testID} style={styles.figureValue}>
        {parts.map((part, i) =>
          /^\d/.test(part) ? (
            part
          ) : (
            <Text key={i} style={styles.figureUnit}>
              {part}
            </Text>
          ),
        )}
      </Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

// Bottom sheet of the mockup 10, reduced to distance and duration.
export function RouteSummarySheet({
  distanceKm,
  durationS,
}: {
  distanceKm: number;
  durationS: number;
}) {
  return (
    <View testID="route-summary" style={styles.sheet}>
      <View style={styles.summary}>
        <Figure
          testID="route-distance"
          value={formatDistance(distanceKm)}
          label={t('route.distance')}
        />
        <Figure
          testID="route-duration"
          value={formatDuration(durationS)}
          label={t('route.duration')}
        />
      </View>
    </View>
  );
}

const MESSAGES: Record<RouteErrorKind, { title: TextKey; text: TextKey }> = {
  outOfZone: { title: 'route.outOfZoneTitle', text: 'route.outOfZoneText' },
  noRoute: { title: 'route.noRouteTitle', text: 'route.noRouteText' },
  engineUnavailable: {
    title: 'route.engineUnavailableTitle',
    text: 'route.engineUnavailableText',
  },
  zoneUnreadable: {
    title: 'route.zoneUnreadableTitle',
    text: 'route.zoneUnreadableText',
  },
  failed: { title: 'route.failedTitle', text: 'route.failedText' },
};

// Error sheet of the mockup 52: the cyclist, a title, a sentence, one exit.
export function RouteErrorSheet({
  kind,
  onRemove,
  onHeight,
}: {
  kind: RouteErrorKind;
  onRemove: () => void;
  onHeight?: (height: number) => void;
}) {
  const message = MESSAGES[kind];
  return (
    <View
      testID="route-error"
      accessibilityRole="alert"
      style={styles.sheet}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
    >
      <Svg
        width="100%"
        height={106}
        viewBox="50 262 290 162"
        preserveAspectRatio="xMidYMid meet"
        accessible={false}
      >
        <CyclistScene />
      </Svg>
      <Text
        accessibilityRole="header"
        style={[text.titleName, styles.errTitle]}
      >
        {t(message.title)}
      </Text>
      <Text style={[text.secondary, styles.errText]}>{t(message.text)}</Text>
      <View style={styles.errButton}>
        <Button
          testID="route-error-remove"
          variant="secondary"
          label={t('route.removePoint')}
          onPress={onRemove}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cream,
  },
  topRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.s1,
    gap: spacing.s1,
  },
  closeButton: {
    width: target.stop,
    height: target.stop,
    borderRadius: radius.button48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    ...text.buttonAction,
    fontSize: 18,
    lineHeight: 26,
    color: colors.brown,
  },
  bubbleRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bubble: {
    backgroundColor: colors.brown,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    ...shadow,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onBrown,
  },
  sheet: {
    backgroundColor: colors.cream,
    borderWidth: border.strong,
    borderBottomWidth: 0,
    borderColor: colors.brown,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 13,
    paddingHorizontal: 13,
    paddingBottom: spacing.s4,
  },
  summary: { flexDirection: 'row', gap: spacing.s6, paddingLeft: 3 },
  figure: { flexShrink: 0 },
  figureValue: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    color: colors.brown,
    fontVariant: ['tabular-nums'],
  },
  figureUnit: { fontSize: 17, fontWeight: '700' },
  errTitle: { marginHorizontal: 3, marginTop: 4 },
  errText: { marginHorizontal: 3, marginTop: 6 },
  errButton: { marginTop: spacing.s3 },
});
