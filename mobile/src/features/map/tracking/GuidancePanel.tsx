import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n/t';
import { directionLabel, type Direction } from '@/core/tracking/directionText';
import { panelNumber, type Panel } from '@/core/tracking/trackingState';
import { navColors } from '@/ui/theme';

import { Picto, pictoOf, type PictoKind } from './Picto';

// The panel at the top of the tracking (mockup 30): 262 tall on a phone with
// a 47 notch, always the same structure so that the screen does not jump from
// one state to the next: pictogram and big distance, instruction, a line below.
const CONTENT_HEIGHT = 215;

type Lines = {
  picto: { kind: PictoKind; flip: boolean };
  /** The big number and its unit; null: a title in its place (waiting). */
  distance: { value: string; unit: string } | null;
  title?: string;
  instruction?: string;
  note?: string;
  label: string;
};

// With a line below ("Signal GPS perdu"), the instruction has one line: the
// kind of way is dropped (mockup 30, note).
function withoutWay(direction: Direction): Direction {
  if (direction.kind !== 'turn') return direction;
  const { way: _way, then, ...rest } = direction;
  if (!then) return rest;
  const { way: _thenWay, ...thenRest } = then;
  return { ...rest, then: thenRest };
}

function linesOf(panel: Panel): Lines {
  const distance = panelNumber(panel);
  const spoken = distance ? `${distance.value} ${distance.unit}` : '';
  const reason =
    panel.reason === 'hand'
      ? t('tracking.reason.hand')
      : panel.reason === 'outOfZone'
        ? t('tracking.reason.outOfZone')
        : undefined;
  switch (panel.kind) {
    case 'waiting':
      return {
        picto: { kind: 'gps', flip: false },
        distance: null,
        title: t('tracking.waiting'),
        note: panel.silent
          ? t('tracking.waitingSilent')
          : t('tracking.waitingHint'),
        label: `${t('tracking.waiting')} ${
          panel.silent ? t('tracking.waitingSilent') : t('tracking.waitingHint')
        }`,
      };
    case 'approach':
      return {
        picto: { kind: 'start', flip: false },
        distance,
        instruction: t('tracking.toStart'),
        note: t('tracking.toStartHint'),
        label: t('tracking.toStartLabel', { distance: spoken }),
      };
    case 'off':
      return {
        picto: { kind: 'off', flip: false },
        distance,
        instruction: t('tracking.offTrack'),
        note: t('tracking.offTrackHint'),
        label: t('tracking.offTrackLabel', { distance: spoken }),
      };
    case 'follow':
      return {
        picto: { kind: 'follow', flip: false },
        distance,
        instruction: t('tracking.follow'),
        note: reason,
        label: t('tracking.panelLabel', {
          distance: spoken,
          direction: t('tracking.follow'),
        }),
      };
    case 'arrive':
      return {
        picto: { kind: 'arrive', flip: false },
        distance,
        // Under 30 m there is no number: the word takes its place.
        title: distance ? undefined : t('tracking.arrive'),
        instruction: distance ? t('tracking.arrive') : undefined,
        note: reason,
        label: distance
          ? t('tracking.panelLabel', {
              distance: spoken,
              direction: t('tracking.arrive'),
            })
          : t('tracking.arrive'),
      };
    default: {
      const text = panel.direction
        ? directionLabel(
            panel.gpsLost ? withoutWay(panel.direction) : panel.direction,
          )
        : '';
      return {
        picto: pictoOf(panel.direction),
        distance,
        instruction: text,
        label: t('tracking.panelLabel', { distance: spoken, direction: text }),
      };
    }
  }
}

export const GuidancePanel = memo(function GuidancePanel({
  panel,
}: {
  panel: Panel;
}) {
  const insets = useSafeAreaInsets();
  const lines = linesOf(panel);
  const note = panel.gpsLost ? t('tracking.gpsLost') : lines.note;
  return (
    <View
      testID="tracking-panel"
      accessible
      accessibilityLabel={lines.label}
      accessibilityLiveRegion="none"
      style={[
        styles.panel,
        {
          height: insets.top + CONTENT_HEIGHT,
          paddingTop: insets.top + 4,
          backgroundColor: panel.imminent
            ? navColors.imminent
            : navColors.background,
        },
      ]}
    >
      <View style={styles.row}>
        <Picto kind={lines.picto.kind} flip={lines.picto.flip} />
        {lines.distance ? (
          <Text
            testID="tracking-distance"
            style={styles.distance}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {lines.distance.value}
            <Text style={styles.unit}> {lines.distance.unit}</Text>
          </Text>
        ) : (
          <Text
            style={styles.title}
            numberOfLines={2}
            maxFontSizeMultiplier={1.2}
          >
            {lines.title}
          </Text>
        )}
      </View>
      {lines.instruction ? (
        <Text
          testID="tracking-instruction"
          style={styles.instruction}
          numberOfLines={note ? 1 : 2}
          maxFontSizeMultiplier={1.2}
        >
          {lines.instruction}
        </Text>
      ) : null}
      {note ? (
        <Text
          testID="tracking-note"
          style={styles.note}
          numberOfLines={lines.instruction ? 1 : 2}
          maxFontSizeMultiplier={1.2}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: navColors.text,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 124 },
  distance: {
    flexShrink: 1,
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '800',
    letterSpacing: -1,
    color: navColors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 40, fontWeight: '800', letterSpacing: 0 },
  title: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: navColors.text,
  },
  instruction: {
    marginTop: 8,
    paddingLeft: 4,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: navColors.text,
  },
  note: {
    marginTop: 6,
    paddingLeft: 4,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    color: navColors.text,
  },
});
