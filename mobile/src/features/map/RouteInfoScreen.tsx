import { useSelector } from '@tanstack/react-store';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { summarize } from '@/core/draft/legs';
import { t } from '@/core/i18n/t';
import {
  formatAscent,
  formatDistance,
  formatDuration,
  groupThousands,
} from '@/core/routing/formatRoute';
import {
  summarizeDifficulty,
  type DifficultyInfo,
} from '@/core/route-info/difficulty';
import {
  summarizeInfo,
  type AltitudeInfo,
  type Block,
  type TerrainInfo,
} from '@/core/route-info/routeInfo';
import type { TextKey } from '@/core/i18n/fr';
import { zoneLine } from '@/core/routes/routeText';
import { useSavedRoute } from '@/shared-data/routes/useRoutes';
import { Button } from '@/ui/Button';
import { DashedStroke } from '@/ui/DashedStroke';
import { ChevronIcon, HandModeIcon } from '@/ui/icons';
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
import { useDifficultyTable } from './useDifficultyTable';
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

// The "Difficulté" line of mockup 20: known levels, then "unknown" in the
// secondary color. Without any known level, one sentence.
function DifficultyLine({ shares }: { shares: DifficultyInfo['shares'] }) {
  const known = shares.filter((share) => share.part !== 'unknown');
  const unknown = shares.find((share) => share.part === 'unknown');
  if (known.length === 0) {
    return (
      <Text testID="info-difficulty" style={[text.secondary, styles.line]}>
        {t('info.difficultyUnknown')}
      </Text>
    );
  }
  const knownText = known
    .map((share) =>
      t(
        share.percent === 0
          ? 'info.difficultyShareLow'
          : 'info.difficultyShare',
        {
          level: t(`info.difficultyLevel.${share.part as 0}`),
          n: share.percent,
        },
      ),
    )
    .join(t('info.difficultySeparator'));
  return (
    <Text testID="info-difficulty" style={[text.secondary, styles.line]}>
      <Text style={styles.bold}>{t('info.difficultyLabel')}</Text>
      {knownText}
      {unknown ? (
        <Text style={styles.secondaryColor}>
          {t('info.difficultySeparator')}
          {t(
            unknown.percent === 0
              ? 'info.difficultyUnknownShareLow'
              : 'info.difficultyUnknownShare',
            { n: unknown.percent },
          )}
          {t('info.difficultyRarely')}
        </Text>
      ) : (
        t('info.difficultyEnd')
      )}
    </Text>
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

// A figure of the grid: being calculated, missing, or a value.
export type Figure =
  | { status: 'pending' }
  | { status: 'missing' }
  | { status: 'ready'; value: number };

function figureText(figure: Figure, format: (value: number) => string) {
  return figure.status === 'ready'
    ? format(figure.value)
    : figure.status === 'missing'
      ? t('route.noFigure')
      : t('info.pending');
}

// What the Infos screens show, in mockup 20: title, map, four figures, then
// the profile, the terrain and the difficulty (a block left out when its
// prop is absent). The creation and the saved routes both use it.
export function RouteInfoView({
  title,
  subtitle,
  back,
  map,
  distance,
  duration,
  ascent,
  descent,
  caption,
  altitudes,
  terrain,
  difficulty,
  notice,
  actions,
}: {
  title: string;
  subtitle?: string;
  back?: { label: string; accessibilityLabel: string; onPress: () => void };
  map: ReactNode;
  distance: Figure;
  duration: Figure;
  /** Left out: the cell is not drawn. */
  ascent?: Figure;
  descent?: Figure;
  /** Under the figures: "Chiffres du dernier calcul…". */
  caption?: string;
  altitudes?: Block<AltitudeInfo>;
  terrain?: Block<TerrainInfo>;
  difficulty?: Block<DifficultyInfo>;
  notice?: ReactNode;
  actions?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const bandsDrawn = terrain?.status === 'ready' ? terrain.segments : null;
  const missingLabel = (figure: Figure, key: TextKey) =>
    figure.status === 'missing' ? t(key) : undefined;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        {back && (
          <Pressable
            testID="info-back"
            accessibilityRole="button"
            accessibilityLabel={back.accessibilityLabel}
            onPress={back.onPress}
            style={styles.back}
          >
            <View style={styles.backIcon}>
              <ChevronIcon color={colors.brown} />
            </View>
            <Text style={styles.backText}>{back.label}</Text>
          </Pressable>
        )}
        <View style={styles.header}>
          <Text
            testID="info-title"
            accessibilityRole="header"
            numberOfLines={1}
            style={text.titleName}
          >
            {title}
          </Text>
          {subtitle && (
            <Text testID="info-subtitle" style={text.secondary}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
      >
        {map}

        <View style={styles.grid}>
          <InfoCell
            testID="info-distance"
            value={figureText(distance, formatDistance)}
            label={t('route.distance')}
            color={colors.mustard}
          />
          <InfoCell
            testID="info-duration"
            value={figureText(duration, formatDuration)}
            label={t('route.duration')}
            color={colors.orange}
          />
          {ascent && (
            <InfoCell
              testID="info-ascent"
              value={figureText(ascent, formatAscent)}
              label={t('route.ascent')}
              color={colors.rust}
              accessibilityLabel={missingLabel(
                ascent,
                'route.ascentMissingLabel',
              )}
            />
          )}
          {descent && (
            <InfoCell
              testID="info-descent"
              value={figureText(descent, formatAscent)}
              label={t('info.descent')}
              color={colors.petrol}
              accessibilityLabel={missingLabel(
                descent,
                'info.descentMissingLabel',
              )}
            />
          )}
        </View>
        {caption && (
          <Text testID="info-caption" style={[text.caption, styles.caption]}>
            {caption}
          </Text>
        )}
        {notice}

        {altitudes && (
          <>
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
              <Message testID="info-profile-pending">
                {t('info.pending')}
              </Message>
            )}
          </>
        )}

        {terrain &&
          (terrain.status === 'ready' ? (
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
          ))}

        {difficulty &&
          (difficulty.status === 'ready' ? (
            <DifficultyLine shares={difficulty.shares} />
          ) : difficulty.status === 'missing' ? (
            <Message testID="info-difficulty-missing">
              {t('info.difficultyMissing')}
            </Message>
          ) : (
            <Message testID="info-difficulty-pending">
              {t('info.pending')}
            </Message>
          ))}
      </ScrollView>
      {actions && (
        <View
          style={[
            styles.actions,
            { paddingBottom: insets.bottom + spacing.s3 },
          ]}
        >
          {actions}
        </View>
      )}
    </View>
  );
}

// Infos of the route being created (mockup 20). It computes nothing: the
// legs, the altitudes and the terrain come from the cache of the creation
// screen, under the same keys (ADR 0017, sections 6 and 7). Once the route
// is saved, the title is its name (ADR 0019, section 4).
export function RouteInfoScreen() {
  const router = useRouter();
  const { zone, store, savedStore, kept } = useDraftSession();
  const draft = useSelector(store, (s) => s.draft);
  const routeId = useSelector(savedStore, (s) => s.routeId);
  const route = useSavedRoute(routeId).data;
  const rawLegs = useLegResults(draft, zone, kept);
  // `useLegResults` gives a new array at each render: keep the old one while
  // nothing changed, so that the geometry below is not computed again.
  const [legs, setLegs] = useState(rawLegs);
  if (legs !== rawLegs && !sameLegs(legs, rawLegs)) setLegs(rawLegs);
  const legInfos = useLegInfos(draft, zone, rawLegs, true);
  const info = summarizeInfo(legInfos);
  const summary = summarize(
    draft,
    legs.map((leg) => (leg.status === 'done' ? leg.result : undefined)),
  );
  const geometry = useMemo(
    () => mainGeometry(draft, legs, null),
    [draft, legs],
  );
  const difficulty = summarizeDifficulty(legInfos, useDifficultyTable(zone));
  const { altitudes, terrain } = info;
  const known = summary.complete;
  const readyOr = (value: number | undefined): Figure =>
    value !== undefined
      ? { status: 'ready', value }
      : altitudes.status === 'missing'
        ? { status: 'missing' }
        : { status: 'pending' };

  return (
    <RouteInfoView
      title={route && route.readable ? route.name : t('route.new')}
      subtitle={route ? zoneLine(route, 'usable') : undefined}
      map={
        <RouteInfoMap
          zone={zone}
          draft={draft}
          lines={geometry.lines}
          links={geometry.links}
        />
      }
      distance={
        known
          ? { status: 'ready', value: summary.distanceKm }
          : { status: 'pending' }
      }
      duration={
        known
          ? { status: 'ready', value: summary.durationS }
          : { status: 'pending' }
      }
      ascent={readyOr(
        altitudes.status === 'ready' ? altitudes.ascentM : undefined,
      )}
      descent={readyOr(
        altitudes.status === 'ready' ? altitudes.descentM : undefined,
      )}
      altitudes={altitudes}
      terrain={terrain}
      difficulty={difficulty}
      actions={
        <Button
          testID="info-modify"
          variant="secondary"
          label={t('info.modify')}
          accessibilityLabel={t('info.modifyLabel')}
          icon={(color) => <HandModeIcon color={color} />}
          onPress={() => router.back()}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.s4,
  },
  back: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.s1,
  },
  backIcon: { transform: [{ scaleX: -1 }] },
  backText: { fontSize: 17, fontWeight: '600', color: colors.brown },
  caption: { marginTop: 6 },
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
  line: { color: colors.brown, marginTop: 6 },
  bold: { fontWeight: '700' },
  secondaryColor: { color: colors.brown2 },
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
