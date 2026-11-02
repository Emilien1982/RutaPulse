import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { border, colors, radius, shadow, spacing } from '@/ui/theme';

// Help card laid over the map (mockup 11): a mustard badge with an icon, a
// bold lead and a sentence. 76 stay free on the right for the buttons of the
// map.
export function HelpCard({
  top,
  icon,
  lead,
  text,
  testID,
}: {
  top: number;
  /** Drawn in the mustard badge (28). */
  icon: ReactNode;
  lead: string;
  text: string;
  testID: string;
}) {
  return (
    <View style={[styles.row, { top }]} pointerEvents="none">
      <View testID={testID} accessibilityRole="alert" style={styles.card}>
        <View style={styles.badge}>{icon}</View>
        <Text style={styles.text}>
          <Text style={styles.lead}>{lead}</Text>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: spacing.s4, right: 76 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.box,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...shadow,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.brown },
  lead: { fontWeight: '800' },
});
