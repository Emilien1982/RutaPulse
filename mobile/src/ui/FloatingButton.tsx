import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { border, colors, radius, shadow, target } from './theme';

type FloatingButtonProps = {
  accessibilityLabel: string;
  accessibilityHint?: string;
  // Brown background, cream pictogram: the state "on" (the map follows).
  active?: boolean;
  onPress: () => void;
  // Pictogram; receives the color to draw with.
  icon: (color: string) => ReactNode;
};

// Round button laid over the map: light cream, brown border, shadow.
export function FloatingButton({
  accessibilityLabel,
  accessibilityHint,
  active = false,
  onPress,
  icon,
}: FloatingButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={[styles.button, active && styles.active]}
    >
      {icon(active ? colors.cream : colors.brown)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: target.stop,
    height: target.stop,
    borderRadius: radius.round,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  active: { backgroundColor: colors.brown },
});
