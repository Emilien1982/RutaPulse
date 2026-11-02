import { StyleSheet, View } from 'react-native';

import { colors } from '@/ui/theme';

/** Bar of a download (mockup 41); `label` is read aloud. */
export function ProgressBar({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.bar}
    >
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.brown,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.mustard,
    borderRightWidth: 2,
    borderColor: colors.brown,
  },
});
