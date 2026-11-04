import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { StripedBanner } from './StripedBanner';
import { colors, spacing, text } from './theme';

type ScreenFrameProps = {
  title: string;
  children: ReactNode;
  /** Top of the title (default 101). A screen with a button above it lowers it. */
  titleTop?: number;
};

export const TITLE_TOP = 101;

// Frame of the tab screens of the mockups (41, 80): cream background, striped
// banner with the title over its sun area, then the content (12 under the
// banner, 12 from the sides).
export function ScreenFrame({
  title,
  children,
  titleTop = TITLE_TOP,
}: ScreenFrameProps) {
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
          style={[text.titleScreen, styles.title, { top: titleTop }]}
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
  title: { position: 'absolute', left: spacing.s4 },
  body: { marginTop: spacing.s3, paddingHorizontal: spacing.s3 },
});
