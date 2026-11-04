// The round "!" of the mockups: dashed ring on a list line and in the notices
// ("what is missing"), full red disc before an error message.
import { StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

export function SignalMark({
  size = 16,
  filled = false,
  testID,
}: {
  size?: number;
  /** A full disc of `colors.danger` with a cream mark, instead of a ring. */
  filled?: boolean;
  testID?: string;
}) {
  const color = filled ? colors.onBrown : colors.brown;
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        filled && styles.filled,
      ]}
    >
      <Text
        style={{
          fontSize: Math.round(size * 0.7),
          lineHeight: Math.round(size * 0.8),
          fontWeight: '800',
          color,
        }}
      >
        !
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brown,
  },
  filled: {
    borderStyle: 'solid',
    borderWidth: 0,
    backgroundColor: colors.danger,
  },
});
