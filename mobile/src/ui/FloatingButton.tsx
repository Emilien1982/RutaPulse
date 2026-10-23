import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { border, colors, radius, shadow, target } from './theme';

type FloatingButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  // Pictogram; receives the color to draw with.
  icon: (color: string) => ReactNode;
};

// Round button laid over the map: light cream, brown border, shadow.
export function FloatingButton({
  accessibilityLabel,
  onPress,
  icon,
}: FloatingButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.button}
    >
      {icon(colors.brown)}
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
});
