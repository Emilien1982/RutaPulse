// The empty list (mockup 40, state 2): the cyclist of the empty map, and the
// two ways to get a first route.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Rect } from 'react-native-svg';

import { t } from '@/core/i18n/t';
import { Button } from '@/ui/Button';
import { CyclistScene } from '@/ui/Cyclist';
import { PlusIcon } from '@/ui/icons';
import { colors, spacing, text } from '@/ui/theme';

function Art() {
  return (
    <Svg
      width="100%"
      height={300}
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
      <CyclistScene />
    </Svg>
  );
}

export function RoutesEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <View testID="routes-empty">
      <Art />
      <Text accessibilityRole="header" style={[text.titleState, styles.center]}>
        {t('routes.emptyTitle')}
      </Text>
      <Text style={[text.body, styles.center, styles.help]}>
        {t('routes.emptyText')}
      </Text>
      <View style={styles.button}>
        <Button
          testID="routes-create"
          label={t('routes.emptyCreate')}
          onPress={onCreate}
          icon={(color) => <PlusIcon color={color} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  help: { color: colors.brown2, marginTop: spacing.s2 },
  button: { paddingHorizontal: 43, marginTop: spacing.s6 },
});
