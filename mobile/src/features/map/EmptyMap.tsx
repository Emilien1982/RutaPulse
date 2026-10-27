import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { t } from '@/core/i18n/t';
import { Button } from '@/ui/Button';
import { CyclistScene } from '@/ui/Cyclist';
import { DownloadIcon } from '@/ui/icons';
import { colors, spacing, text } from '@/ui/theme';

// Empty state of the Map tab (mockup 91): no ready zone. The big striped sun
// and the cyclist are drawn, as in the mockup (390 x 425, from y = 47).
function Sun() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 390 425"
      preserveAspectRatio="xMidYMin meet"
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
      <Rect x="-400" y="220" width="1190" height="9" fill={colors.mustard} />
      <Rect x="-400" y="229" width="1190" height="9" fill={colors.orange} />
      <Rect x="-400" y="238" width="1190" height="9" fill={colors.rust} />
      <Rect x="-400" y="247" width="1190" height="9" fill={colors.brown} />
      <Path
        id="collines"
        d="M-400 290 H0 C40 274 80 274 120 286 C160 298 200 290 240 280 C290 268 340 276 390 288 H790 V296 H-400 Z"
        fill={colors.olive}
        opacity={0.55}
      />
      <CyclistScene />
    </Svg>
  );
}

export function EmptyMap({ onChooseZone }: { onChooseZone: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.sun}>
        <Sun />
      </View>
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
    paddingTop: 47,
  },
  // The mockup is 844 tall. The gaps are kept, in the flow; when the screen is
  // shorter (or the system text bigger), the drawing shrinks first.
  sun: { height: 425, flexShrink: 1, minHeight: 120 },
  text: { paddingHorizontal: spacing.s6, marginTop: 12 },
  center: { textAlign: 'center' },
  help: { color: colors.brown2, marginTop: spacing.s2 },
  button: { paddingHorizontal: 55, marginTop: 31, marginBottom: 16 },
});
