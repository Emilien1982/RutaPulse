// The end of the ride (mockup v1/60; ADR 0021, sections 4 and 5.2): "ARRIVÉE !"
// or "SORTIE TERMINÉE", the real distance, ascent and duration, one button.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n/t';
import {
  formatAscent,
  formatDistance,
  formatDuration,
} from '@/core/routing/formatRoute';
import { RidePodium } from '@/ui/RidePodium';
import { border, colors, radius, spacing, text } from '@/ui/theme';

type RideSummaryProps = {
  arrived: boolean;
  /** Name of the route; absent: not shown. */
  name?: string;
  /** Real distance ridden (m). */
  distanceM: number;
  /** Real duration (s), pauses included. */
  durationS: number;
  /** Real ascent (m): undefined while the engine answers, null when unknown. */
  ascentM: number | null | undefined;
  onClose: () => void;
};

export function RideSummary({
  arrived,
  name,
  distanceM,
  durationS,
  ascentM,
  onClose,
}: RideSummaryProps) {
  const insets = useSafeAreaInsets();
  const ascent =
    ascentM === undefined
      ? t('ride.pending')
      : ascentM === null
        ? t('route.noFigure')
        : formatAscent(ascentM);
  return (
    <ScrollView
      testID="ride-end"
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.s4 },
      ]}
    >
      <RidePodium />
      <Text
        accessibilityRole="header"
        style={[styles.title, arrived ? styles.titleShort : styles.titleLong]}
      >
        {t(arrived ? 'ride.arrived' : 'ride.finished')}
      </Text>
      {name ? (
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
      ) : null}
      <View style={styles.card}>
        <Row
          testID="ride-distance"
          color={colors.mustard}
          label={t('ride.distance')}
          value={formatDistance(distanceM / 1000)}
          first
        />
        <Row
          testID="ride-ascent"
          color={colors.orange}
          label={t('route.ascent')}
          value={ascent}
        />
        <Row
          testID="ride-duration"
          color={colors.rust}
          label={t('route.durationShort')}
          value={formatDuration(durationS)}
        />
      </View>
      <Text style={styles.note}>{`✓ ${t('ride.stopped')}`}</Text>
      <Pressable
        testID="ride-close"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.close}
      >
        <Text style={styles.closeText} maxFontSizeMultiplier={1.2}>
          {t('ride.close')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  testID,
  color,
  label,
  value,
  first,
}: {
  testID: string;
  color: string;
  label: string;
  value: string;
  first?: boolean;
}) {
  // Figures big, units small: "25,6 km", "1 h 52".
  const parts = value.split(/(\d+(?: \d{3})*(?:,\d+)?)/);
  return (
    <View style={[styles.row, first ? null : styles.rowBorder]}>
      <View style={[styles.mark, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
      <Text testID={testID} style={styles.value} accessibilityLabel={value}>
        {parts.map((part, index) =>
          index % 2 === 1 || part === '' ? (
            part
          ) : (
            <Text key={index} style={styles.unit}>
              {part}
            </Text>
          ),
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { gap: spacing.s3 },
  title: { ...text.titleName, textAlign: 'center', letterSpacing: 2 },
  titleShort: { fontSize: 44, lineHeight: 64 },
  titleLong: { fontSize: 32, lineHeight: 46 },
  name: { ...text.control, textAlign: 'center', paddingHorizontal: spacing.s6 },
  card: {
    marginHorizontal: spacing.s4,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 18,
  },
  rowBorder: {
    borderTopWidth: 2,
    borderTopColor: 'rgba(58, 31, 15, 0.22)',
  },
  mark: { alignSelf: 'stretch', width: 9, marginRight: 15 },
  label: { ...text.control, flex: 1, color: colors.brown2 },
  value: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    color: colors.brown,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 20, fontWeight: '700' },
  note: { ...text.secondary, textAlign: 'center' },
  close: {
    height: 64,
    marginHorizontal: spacing.s4,
    borderRadius: 32,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { ...text.buttonAction, fontSize: 20, color: colors.onBrown },
});
