import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n/t';
import { navColors } from '@/ui/theme';

// The bar at the bottom of the tracking (mockup 30): "Reste" and "D+ restant".
export const TrackingFooter = memo(function TrackingFooter({
  remaining,
  climbLeft,
}: {
  remaining: string;
  climbLeft: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="tracking-footer"
      style={[styles.bar, { paddingBottom: insets.bottom }]}
    >
      <View style={styles.col}>
        <Text style={styles.label} maxFontSizeMultiplier={1.2}>
          {t('tracking.remaining')}
        </Text>
        <Text
          testID="tracking-remaining"
          style={styles.value}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
        >
          {remaining}
        </Text>
      </View>
      <View style={styles.col}>
        <Text style={styles.label} maxFontSizeMultiplier={1.2}>
          {t('tracking.climbLeft')}
        </Text>
        <Text
          testID="tracking-climb"
          style={styles.value}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
        >
          {climbLeft}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 10,
    paddingLeft: 20,
    paddingRight: 16,
    backgroundColor: navColors.background,
    borderTopWidth: 3,
    borderTopColor: navColors.text,
  },
  col: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
    color: navColors.text2,
  },
  value: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    color: navColors.text,
    fontVariant: ['tabular-nums'],
  },
});
