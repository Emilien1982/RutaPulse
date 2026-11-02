import { useSelector } from '@tanstack/react-store';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { summarize } from '@/core/draft/legs';
import { t } from '@/core/i18n/t';
import {
  formatAscent,
  formatDistance,
  formatDuration,
  groupThousands,
} from '@/core/routing/formatRoute';
import { summarizeInfo } from '@/core/route-info/routeInfo';
import { Button } from '@/ui/Button';
import { DashedStroke } from '@/ui/DashedStroke';
import { HandModeIcon } from '@/ui/icons';
import {
  border,
  colors,
  radius,
  spacing,
  terrainColors,
  text,
} from '@/ui/theme';

import { FIGURE_DIGITS } from './RouteSheets';
import { mainGeometry } from './draftGeometry';
import { useDraftSession } from './DraftSession';
import { ElevationProfile } from './ElevationProfile';
import { RouteInfoMap } from './RouteInfoMap';
import { useLegInfos } from './useLegInfos';
import { sameLegs, useLegResults } from './useLegResults';

// A figure of mockup 20: a card with a colored edge, digits big, the unit
// smaller, a caption under.
function InfoCell({
  value,
  label,
  testID,
  color,
  accessibilityLabel,
}: {
  value: string;
  label: string;
  testID: string;
  color: string;
  accessibilityLabel?: string;
}) {
  const parts = value.split(FIGURE_DIGITS).filter(Boolean);
  const hasDigit = parts.some((part) => /^\d/.test(part));
  return (
    <View
      style={styles.cell}
      accessible={accessibilityLabel ? true : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.cellEdge, { backgroundColor: color }]} />
      <Text testID={testID} style={styles.cellValue}>
        {!hasDigit
          ? value
          : parts.map((part, i) =>
              /^\d/.test(part) ? (
                part
              ) : (
                <Text key={i} style={styles.cellUnit}>
                  {part}
                </Text>
              ),
            )}
      </Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

function Message({
  testID,
  children,
}: {
  testID: string;
  children: ReactNode;
}) {
  return (
    <Text testID={testID} style={[text.secondary, styles.message]}>
      {children}
    </Text>
  );
}

// Infos of the route being created (mockup 20). It computes nothing: the
// legs, the altitudes and the terrain come from the cache of the creation
// screen, under the same keys (ADR 0017, sections 6 and 7).
export function RouteInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { zone, store } = useDraftSession();
  const draft = useSelector(store, (s) => s.draft);
  const rawLegs = useLegResults(draft, zone);
  // `useLegResults` gives a new array at each render: keep the old one while
  // nothing changed, so that the geometry below is not computed again.
  const [legs, setLegs] = useState(rawLegs);
  if (legs !== rawLegs && !sameLegs(legs, rawLegs)) setLegs(rawLegs);
  const info = summarizeInfo(useLegInfos(draft, zone, rawLegs, true));
  const summary = summarize(
    draft,
    legs.map((leg) => (leg.status === 'done' ? leg.result : undefined)),
  );
  const geometry = useMemo(
    () => mainGeometry(draft, legs, null),
    [draft, legs],
  );
  const { altitudes, terrain } = info;
  const known = summary.complete;
  const bandsDrawn = terrain.status === 'ready' ? terrain.segments : null;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={text.titleName}>
            {t('route.new')}
          </Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
      >
        <RouteInfoMap
          zone={zone}
          draft={draft}
          lines={geometry.lines}
          links={geometry.links}
        />

        <View style={styles.grid}>
          <InfoCell
            testID="info-distance"
            value={
              known ? formatDistance(summary.distanceKm) : t('info.pending')
            }
            label={t('route.distance')}
            color={colors.mustard}
          />
          <InfoCell
            testID="info-duration"
            value={
              known ? formatDuration(summary.durationS) : t('info.pending')
            }
            label={t('route.duration')}
            color={colors.orange}
          />
          <InfoCell
            testID="info-ascent"
            value={
              altitudes.status === 'ready'
                ? formatAscent(altitudes.ascentM)
                : altitudes.status === 'missing'
                  ? t('route.noFigure')
                  : t('info.pending')
            }
            label={t('route.ascent')}
            color={colors.rust}
            accessibilityLabel={
              altitudes.status === 'missing'
                ? t('route.ascentMissingLabel')
                : undefined
            }
          />
          <InfoCell
            testID="info-descent"
            value={
              altitudes.status === 'ready'
                ? formatAscent(altitudes.descentM)
                : altitudes.status === 'missing'
                  ? t('route.noFigure')
                  : t('info.pending')
            }
            label={t('info.descent')}
            color={colors.petrol}
            accessibilityLabel={
              altitudes.status === 'missing'
                ? t('info.descentMissingLabel')
                : undefined
            }
          />
        </View>

        <View style={styles.blockTitle}>
          <Text style={text.sectionLabel}>{t('info.profileTitle')}</Text>
          {altitudes.status === 'ready' && (
            <Text testID="info-range" style={text.caption}>
              {t('info.range', {
                min: groupThousands(altitudes.minM),
                max: groupThousands(altitudes.maxM),
              })}
            </Text>
          )}
        </View>
        {altitudes.status === 'ready' ? (
          <ElevationProfile altitudes={altitudes} segments={bandsDrawn} />
        ) : altitudes.status === 'missing' ? (
          <Message testID="info-altitudes-missing">
            {t('info.altitudesMissing')}
          </Message>
        ) : (
          <Message testID="info-profile-pending">{t('info.pending')}</Message>
        )}

        {terrain.status === 'ready' ? (
          <View testID="info-legend" style={styles.legend}>
            {terrain.shares.map((share) => (
              <View key={share.part} style={styles.legendItem}>
                {share.part === 'hand' ? (
                  <DashedStroke color={terrainColors.hand} />
                ) : (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: terrainColors[share.part] },
                    ]}
                  />
                )}
                <Text style={[text.secondary, styles.legendText]}>
                  {t('info.share', {
                    part: t(`info.${share.part}`),
                    n: share.percent,
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : terrain.status === 'missing' ? (
          <Message testID="info-terrain-missing">
            {t('info.terrainMissing')}
          </Message>
        ) : (
          <Message testID="info-terrain-pending">{t('info.pending')}</Message>
        )}
      </ScrollView>
      <View
        style={[styles.actions, { paddingBottom: insets.bottom + spacing.s3 }]}
      >
        <Button
          testID="info-modify"
          variant="secondary"
          label={t('info.modify')}
          accessibilityLabel={t('info.modifyLabel')}
          icon={(color) => <HandModeIcon color={color} />}
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.s4,
  },
  content: { paddingHorizontal: spacing.s4, paddingBottom: spacing.s4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: spacing.s4,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    overflow: 'hidden',
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.box,
    paddingTop: 6,
    paddingBottom: 7,
    paddingLeft: 20,
    paddingRight: 12,
  },
  cellEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9 },
  cellValue: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    color: colors.brown,
    fontVariant: ['tabular-nums'],
  },
  cellUnit: { fontSize: 17, fontWeight: '700' },
  message: { color: colors.brown, marginTop: 4 },
  blockTitle: {
    marginTop: spacing.s3,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 4,
    marginTop: spacing.s2,
  },
  legendText: { color: colors.brown },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.brown,
  },
  actions: { paddingHorizontal: spacing.s4, paddingTop: spacing.s2 },
});
