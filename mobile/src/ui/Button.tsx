import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { border, colors, spacing, target, text } from './theme';

// primary: brown pill, 56 tall ("Choisir une zone")
// secondary: light cream pill with a brown border, 56 tall
// download: mustard pill with a brown border, 48 tall ("Télécharger")
export type ButtonVariant = 'primary' | 'secondary' | 'download';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  // Pictogram drawn before the label; receives the color to draw with.
  icon?: (color: string) => ReactNode;
  // Longer spoken label when the visible one is short.
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  accessibilityLabel,
  disabled,
  testID,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const height = variant === 'download' ? target.stop : target.mainButton;
  const textColor = isPrimary ? colors.onBrown : colors.brown;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        { height, borderRadius: height / 2 },
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'download' && styles.download,
        disabled && styles.disabled,
      ]}
    >
      {icon &&
        (isPrimary ? (
          <View style={styles.sun}>{icon(colors.brown)}</View>
        ) : (
          icon(textColor)
        ))}
      <Text style={[text.buttonAction, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
    paddingHorizontal: spacing.s4,
  },
  primary: { backgroundColor: colors.brown, gap: 10 },
  secondary: {
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
  },
  download: {
    backgroundColor: colors.mustard,
    borderWidth: border.normal,
    borderColor: colors.brown,
  },
  disabled: { opacity: 0.5 },
  sun: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
