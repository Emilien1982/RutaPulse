import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n/t';
import { Button } from '@/ui/Button';
import { colors, spacing, text } from '@/ui/theme';

// PROVISIONAL end screen of phase 8a, T3: a title and "Fermer". The summary
// of the mockup v1/60 (real distance, ascent and duration) is T4.
export function RideEnd({
  arrived,
  onClose,
}: {
  arrived: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="ride-end"
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.s4 },
      ]}
    >
      <Text accessibilityRole="header" style={text.titleName}>
        {t(arrived ? 'ride.arrived' : 'ride.finished')}
      </Text>
      <Button testID="ride-close" label={t('ride.close')} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.s6,
    paddingHorizontal: spacing.s4,
    backgroundColor: colors.cream,
  },
});
