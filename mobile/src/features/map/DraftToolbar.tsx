import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LegMode } from '@/core/draft/draft';
import { t } from '@/core/i18n/t';
import {
  HandModeIcon,
  LoopIcon,
  PathModeIcon,
  TrashIcon,
  UndoIcon,
} from '@/ui/icons';
import { border, colors, radius, spacing, text } from '@/ui/theme';

// "Prochain tronçon": the mode given to the next leg (mockup 10).
export function ModePicker({
  mode,
  onChoose,
}: {
  mode: LegMode;
  onChoose: (mode: LegMode) => void;
}) {
  const options: { mode: LegMode; label: string; icon: ReactNode }[] = [
    {
      mode: 'path',
      label: t('route.modePath'),
      icon: (
        <PathModeIcon color={mode === 'path' ? colors.onBrown : colors.brown} />
      ),
    },
    {
      mode: 'hand',
      label: t('route.modeHand'),
      icon: (
        <HandModeIcon color={mode === 'hand' ? colors.onBrown : colors.brown} />
      ),
    },
  ];
  return (
    <>
      <Text style={styles.heading}>{t('route.nextLeg').toUpperCase()}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('route.nextLeg')}
        style={styles.segments}
      >
        {options.map((option) => {
          const chosen = option.mode === mode;
          return (
            <Pressable
              key={option.mode}
              testID={`route-mode-${option.mode}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={option.label}
              onPress={() => onChoose(option.mode)}
              style={[styles.segment, chosen && styles.segmentChosen]}
            >
              {option.icon}
              <Text
                style={[
                  styles.segmentText,
                  { color: chosen ? colors.onBrown : colors.brown },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function Tool({
  testID,
  label,
  accessibilityLabel,
  icon,
  disabled,
  danger,
  onPress,
}: {
  testID: string;
  label: string;
  accessibilityLabel: string;
  icon: (color: string) => ReactNode;
  disabled: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? colors.danger : colors.brown;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tool, disabled && styles.disabled]}
    >
      {icon(color)}
      <Text style={[styles.toolText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// Annuler, Boucler, Supprimer (mockup 10). Greyed when they cannot act.
export function DraftTools({
  canUndo,
  canLoop,
  canDelete,
  onUndo,
  onLoop,
  onDelete,
}: {
  canUndo: boolean;
  canLoop: boolean;
  canDelete: boolean;
  onUndo: () => void;
  onLoop: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.tools}>
      <Tool
        testID="route-undo"
        label={t('route.undo')}
        accessibilityLabel={t('route.undoLabel')}
        icon={(color) => <UndoIcon color={color} />}
        disabled={!canUndo}
        onPress={onUndo}
      />
      <Tool
        testID="route-loop"
        label={t('route.loop')}
        accessibilityLabel={t('route.loopLabel')}
        icon={(color) => <LoopIcon color={color} />}
        disabled={!canLoop}
        onPress={onLoop}
      />
      <Tool
        testID="route-delete"
        label={t('route.delete')}
        accessibilityLabel={t('route.deleteLabel')}
        icon={(color) => <TrashIcon color={color} />}
        disabled={!canDelete}
        danger
        onPress={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...text.caption,
    letterSpacing: 1.2,
    marginTop: 13,
    marginBottom: 6,
    marginLeft: 3,
  },
  segments: {
    flexDirection: 'row',
    height: 48,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.button48,
    overflow: 'hidden',
    backgroundColor: colors.creamLight,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
  },
  segmentChosen: { backgroundColor: colors.brown },
  segmentText: { fontSize: 17, fontWeight: '600' },
  tools: { flexDirection: 'row', gap: spacing.s2, marginTop: 10 },
  tool: {
    flex: 1,
    height: 56,
    borderRadius: radius.box,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  toolText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
