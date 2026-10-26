import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { StripedBanner } from './StripedBanner';
import { colors, spacing, text } from './theme';

type ScreenFrameProps = { title: string; children: ReactNode };

// Frame of the tab screens of the mockups (41, 80): cream background, striped
// banner with the title over its sun area, then the content (12 under the
// banner, 12 from the sides).
export function ScreenFrame({ title, children }: ScreenFrameProps) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="never"
    >
      <View>
        <StripedBanner />
        <Text
          accessibilityRole="header"
          style={[text.titleScreen, styles.title]}
        >
          {title}
        </Text>
      </View>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: spacing.s6 },
  title: { position: 'absolute', top: 110, left: spacing.s4 },
  body: { marginTop: spacing.s3, paddingHorizontal: spacing.s3 },
});
