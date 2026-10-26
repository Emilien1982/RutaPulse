import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Rect } from 'react-native-svg';

import { t } from '@/core/i18n/t';
import { Button } from '@/ui/Button';
import { DownloadIcon } from '@/ui/icons';
import { colors, spacing, text } from '@/ui/theme';

// Empty state of the Map tab (mockup 91): no ready zone. The big striped sun
// is drawn; the cyclist of the mockup is not (see the report of T5).
function Sun() {
  return (
    <Svg
      width="100%"
      height={256}
      viewBox="0 0 390 256"
      preserveAspectRatio="xMidYMax slice"
      accessible={false}
    >
      <Defs>
        <ClipPath id="sky">
          <Rect x="0" y="0" width="390" height="220" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#sky)">
        <Circle cx="195" cy="220" r="90" fill={colors.mustard} />
        <Rect x="90" y="172" width="210" height="4" fill={colors.cream} />
        <Rect x="90" y="187" width="210" height="6" fill={colors.cream} />
        <Rect x="90" y="203" width="210" height="7" fill={colors.cream} />
      </G>
      <Rect x="0" y="220" width="390" height="9" fill={colors.mustard} />
      <Rect x="0" y="229" width="390" height="9" fill={colors.orange} />
      <Rect x="0" y="238" width="390" height="9" fill={colors.rust} />
      <Rect x="0" y="247" width="390" height="9" fill={colors.brown} />
    </Svg>
  );
}

export function EmptyMap({ onChooseZone }: { onChooseZone: () => void }) {
  return (
    <View style={styles.screen}>
      <Sun />
      <View style={styles.text}>
        <Text
          accessibilityRole="header"
          style={[text.titleState, styles.center]}
        >
          {t('map.emptyTitle')}
        </Text>
        <Text style={[text.body, styles.center, styles.help]}>
          {t('map.emptyText')}
        </Text>
      </View>
      <View style={styles.button}>
        <Button
          label={t('map.chooseZone')}
          onPress={onChooseZone}
          icon={(color) => <DownloadIcon color={color} size={18} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    justifyContent: 'flex-start',
    paddingTop: 96,
  },
  text: { paddingHorizontal: spacing.s6, marginTop: spacing.s6 },
  center: { textAlign: 'center' },
  help: { color: colors.brown2, marginTop: spacing.s2 },
  button: { paddingHorizontal: 55, marginTop: spacing.s6 },
});
