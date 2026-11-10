import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import type { TextKey } from '@/core/i18n/fr';
import { t } from '@/core/i18n/t';
import {
  formatAscent,
  formatDistance,
  formatDuration,
} from '@/core/routing/formatRoute';
import { MAX_SNAP_METERS } from '@/core/routing/routeRequest';
import type { RouteErrorKind } from '@/core/routing/routeResponse';
import { Button } from '@/ui/Button';
import { CyclistErrorScene } from '@/ui/CyclistErrorScene';
import { ChevronIcon, CloseIcon, HandModeIcon } from '@/ui/icons';
import { Stripes } from '@/ui/Stripes';
import {
  border,
  colors,
  radius,
  shadow,
  sheetShadow,
  spacing,
  target,
  text,
} from '@/ui/theme';

// Below this width (in dp, text scale removed) the summary gets compact.
const COMPACT_BELOW = 390;

// Top bar of the creation (mockup 10): cream, title, a way out, 3 stripes.
export function RouteTopBar({
  onClose,
  onHeight,
  title,
  onSave,
  saveLabel,
  saveOffLabel,
}: {
  onClose: () => void;
  onHeight: (height: number) => void;
  /** The name of a saved route; "Nouvel itinéraire" without it. */
  title?: string;
  /** Hidden without it. */
  onSave?: { enabled: boolean; press: () => void };
  saveLabel?: string;
  saveOffLabel?: string;
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
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.topTitle, styles.topTitleFlex]}
        >
          {title ?? t('route.new')}
        </Text>
        {onSave && (
          <Pressable
            // Android does not redraw a changed `borderStyle`: a new key.
            key={onSave.enabled ? 'on' : 'off'}
            testID="route-save"
            accessibilityRole="button"
            accessibilityLabel={onSave.enabled ? saveLabel : saveOffLabel}
            accessibilityState={{ disabled: !onSave.enabled }}
            disabled={!onSave.enabled}
            onPress={onSave.press}
            style={[styles.save, !onSave.enabled && styles.saveOff]}
          >
            <Text
              style={[styles.saveText, !onSave.enabled && styles.saveTextOff]}
            >
              {t('route.save')}
            </Text>
          </Pressable>
        )}
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

// Digits with thousands grouped ("1\u202F250") or a decimal comma.
export const FIGURE_DIGITS = /(\d+(?:\u202F\d{3})*(?:,\d+)?)/;

// Digits big, the rest (unit) smaller: "25,1" + " km", "1" + " h " + "35".
function Figure({
  value,
  label,
  testID,
  accessibilityLabel,
  compact,
}: {
  value: string;
  label: string;
  compact: boolean;
  testID: string;
  /** Set when the value alone says too little (no route yet). */
  accessibilityLabel?: string;
}) {
  const parts = value.split(FIGURE_DIGITS).filter(Boolean);
  // A value without digit (the dash) is a value, not a unit.
  const hasDigit = parts.some((part) => /^\d/.test(part));
  return (
    // One element for the reader: the label replaces value and caption.
    <View
      style={styles.figure}
      accessible={accessibilityLabel ? true : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        testID={testID}
        numberOfLines={1}
        style={compact ? styles.figureValueCompact : styles.figureValue}
      >
        {!hasDigit
          ? value
          : parts.map((part, i) =>
              /^\d/.test(part) ? (
                part
              ) : (
                <Text
                  key={i}
                  style={compact ? styles.figureUnitCompact : styles.figureUnit}
                >
                  {part}
                </Text>
              ),
            )}
      </Text>
      <Text numberOfLines={1} style={text.caption}>
        {label}
      </Text>
    </View>
  );
}

// Bottom sheet of the mockup 10: distance and duration, then what the caller
// puts under them (mode of the next leg, tools). The figures stay on screen,
// a little faded, while a leg is being computed.
export function RouteSummarySheet({
  distanceKm,
  durationS,
  ascentM,
  pending,
  empty,
  onOpen,
  children,
}: {
  distanceKm: number;
  durationS: number;
  /** Ascent (D+) in m; null when the altitudes are missing. */
  ascentM?: number | null;
  pending?: boolean;
  /** No route yet (under 2 points): a dash instead of the figures. */
  empty?: boolean;
  /** Opens the Infos screen; absent when it cannot open yet. */
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < COMPACT_BELOW;
  const figures = (
    <View
      testID="route-figures"
      style={[
        styles.figures,
        compact && styles.figuresCompact,
        pending && styles.pending,
      ]}
    >
      <Figure
        testID="route-distance"
        value={empty ? t('route.noFigure') : formatDistance(distanceKm)}
        label={t('route.distance')}
        compact={compact}
        accessibilityLabel={empty ? t('route.distanceEmptyLabel') : undefined}
      />
      <Figure
        testID="route-ascent"
        value={
          empty || ascentM === null || ascentM === undefined
            ? t('route.noFigure')
            : formatAscent(ascentM)
        }
        label={t(compact ? 'route.ascentShort' : 'route.ascent')}
        compact={compact}
        accessibilityLabel={
          empty
            ? t('route.ascentEmptyLabel')
            : ascentM === null
              ? t('route.ascentMissingLabel')
              : undefined
        }
      />
      <Figure
        testID="route-duration"
        value={empty ? t('route.noFigure') : formatDuration(durationS)}
        label={t(compact ? 'route.durationShort' : 'route.duration')}
        compact={compact}
        accessibilityLabel={empty ? t('route.durationEmptyLabel') : undefined}
      />
    </View>
  );
  return (
    <View
      testID="route-summary"
      style={[styles.sheet, { paddingBottom: insets.bottom + spacing.s3 }]}
    >
      {onOpen ? (
        // One target: the figures and the chevron, which is only its sign.
        <Pressable
          testID="route-open-infos"
          accessibilityRole="button"
          accessibilityLabel={[
            t('info.openLabel'),
            t('route.summaryLabelPart', {
              name: t('route.distance'),
              value: formatDistance(distanceKm),
            }),
            ascentM === null || ascentM === undefined
              ? t('route.ascentMissingLabel')
              : t('route.summaryLabelPart', {
                  name: t('route.ascent'),
                  value: formatAscent(ascentM),
                }),
            t('route.summaryLabelPart', {
              name: t('route.duration'),
              value: formatDuration(durationS),
            }),
          ].join(', ')}
          accessibilityHint={t('info.openHint')}
          onPress={onOpen}
          android_ripple={{ color: colors.ripple, borderless: false }}
          style={({ pressed }) => [
            styles.summary,
            styles.summaryClip,
            pressed && styles.summaryPressed,
          ]}
        >
          {figures}
          <View style={[styles.chevron, compact && styles.chevronCompact]}>
            <ChevronIcon color={colors.brown} />
          </View>
        </Pressable>
      ) : (
        <View style={[styles.summary, styles.summaryClip]}>
          {figures}
          <View
            testID="route-open-infos-off"
            style={[
              styles.chevron,
              compact && styles.chevronCompact,
              styles.chevronOff,
            ]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <ChevronIcon color={colors.brown} />
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

const MESSAGES: Record<RouteErrorKind, { title: TextKey; text: TextKey }> = {
  outOfZone: { title: 'route.outOfZoneTitle', text: 'route.outOfZoneText' },
  farFromPath: {
    title: 'route.farFromPathTitle',
    text: 'route.farFromPathText',
  },
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

// Error sheet of the mockup 52: the cyclist, a title, a sentence, then the
// ways out: "Relier ce point à la main" (a secondary button, only where it
// makes sense) above "Retirer ce point" (an underlined link, no download
// button: there is only one zone).
export function RouteErrorSheet({
  kind,
  onRemove,
  onRelink,
  onHeight,
}: {
  kind: RouteErrorKind;
  onRemove: () => void;
  /** Absent when there is no leg to draw by hand. */
  onRelink?: () => void;
  onHeight?: (height: number) => void;
}) {
  const message = MESSAGES[kind];
  // "Relier" only where it makes sense; then "Retirer" is an underlined link
  // (M7), otherwise it is the one secondary button.
  const canRelink =
    !!onRelink && (kind === 'farFromPath' || kind === 'outOfZone');
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="route-error"
      accessibilityRole="alert"
      style={[styles.sheet, { paddingBottom: insets.bottom + spacing.s3 }]}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
    >
      <Svg
        width="100%"
        height={106}
        viewBox="0 0 358 106"
        preserveAspectRatio="xMidYMid meet"
        accessible={false}
      >
        <CyclistErrorScene limit={kind === 'outOfZone'} />
      </Svg>
      <Text
        accessibilityRole="header"
        style={[text.titleName, styles.errTitle]}
      >
        {t(message.title)}
      </Text>
      <Text style={[text.secondary, styles.errText]}>
        {t(message.text, { m: MAX_SNAP_METERS })}
      </Text>
      {canRelink ? (
        <>
          <View style={styles.errButton}>
            <Button
              testID="route-error-relink"
              variant="secondary"
              label={t('route.relinkHand')}
              icon={(color) => <HandModeIcon color={color} />}
              onPress={() => onRelink?.()}
            />
          </View>
          <Pressable
            testID="route-error-remove"
            accessibilityRole="button"
            accessibilityLabel={t('route.removePoint')}
            onPress={onRemove}
            style={styles.errLink}
          >
            <Text style={styles.errLinkText}>{t('route.removePoint')}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.errButton}>
          <Button
            testID="route-error-remove"
            variant="secondary"
            label={t('route.removePoint')}
            onPress={onRemove}
          />
        </View>
      )}
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
  topTitleFlex: { flex: 1 },
  // "Enregistrer" (mockup 40, 8b): mustard; dashed and pale when off.
  save: {
    height: 48,
    paddingHorizontal: 18,
    marginRight: spacing.s3,
    borderRadius: radius.button48,
    backgroundColor: colors.mustard,
    borderWidth: 2.5,
    borderColor: colors.brown,
    justifyContent: 'center',
  },
  saveOff: {
    backgroundColor: colors.creamLight,
    borderStyle: 'dashed',
    borderColor: colors.brown2,
  },
  saveText: { fontSize: 17, fontWeight: '700', color: colors.brown },
  saveTextOff: { color: colors.brown2 },
  bubbleRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bubble: {
    maxWidth: 344,
    marginHorizontal: spacing.s4,
    backgroundColor: colors.brown,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    ...shadow,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
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
    ...sheetShadow,
  },
  // Figures on the left, the chevron on the right; the same box whether the
  // summary opens or not, so nothing moves when it becomes touchable.
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.box,
    // Keeps the figures out of the rounded corners (clipped by summaryClip);
    // the negative margins give the room back, so nothing moves.
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginHorizontal: -6,
    marginVertical: -4,
  },
  // Android does not clip the ripple to the radius by itself.
  summaryClip: { overflow: 'hidden' },
  summaryPressed: { backgroundColor: colors.creamLight },
  figures: {
    flexShrink: 1,
    flexDirection: 'row',
    gap: 16,
    paddingLeft: 3,
  },
  figuresCompact: { gap: 12 },
  // cible.arret: a round button of 48, cream light, a brown border.
  chevron: {
    marginLeft: 12,
    width: target.stop,
    height: target.stop,
    borderRadius: radius.button48,
    borderWidth: border.normal,
    borderColor: colors.brown,
    backgroundColor: colors.creamLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronCompact: { marginLeft: 8 },
  chevronOff: { opacity: 0.4 },
  pending: { opacity: 0.55 },
  figure: { flexShrink: 0 },
  figureValue: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    color: colors.brown,
    fontVariant: ['tabular-nums'],
  },
  figureValueCompact: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    color: colors.brown,
    fontVariant: ['tabular-nums'],
  },
  figureUnit: { fontSize: 17, fontWeight: '700' },
  figureUnitCompact: { fontSize: 15, fontWeight: '700' },
  errTitle: { marginHorizontal: 3, marginTop: 4 },
  errText: { marginHorizontal: 3, marginTop: 6 },
  errButton: { marginTop: spacing.s3 },
  // Underlined link (`texte.bouton`: 17, 600), a target of 48.
  errLink: {
    height: target.stop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errLinkText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.brown,
    textDecorationLine: 'underline',
  },
});
