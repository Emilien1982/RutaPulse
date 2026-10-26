import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, text } from './theme';

type SwitchRowProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

// A whole row is the touch target (56 tall); the native switch is only the
// drawing, in the theme colors. The row carries role and label.
export function SwitchRow({ label, value, onValueChange }: SwitchRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <Text style={[text.control, styles.label]}>{label}</Text>
      <View style={styles.switchBox}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.sand, true: colors.brown }}
          thumbColor={colors.creamLight}
          ios_backgroundColor={colors.sand}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s3,
    minHeight: 56,
  },
  label: { flex: 1 },
  // The native switch is drawn at the top of its place: center it by hand.
  switchBox: { height: 56, justifyContent: 'center' },
});
