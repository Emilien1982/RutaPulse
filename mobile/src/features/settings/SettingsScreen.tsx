import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import {
  useSettings,
  useSetWifiOnly,
} from '@/shared-data/settings/useSettings';
import { ScreenFrame } from '@/ui/ScreenFrame';
import { SwitchRow } from '@/ui/SwitchRow';
import { border, colors, radius, spacing, text } from '@/ui/theme';

export const settingsTitle = t('settings.title');

// Screen "Réglages" (mockup 80). In phase 2, only the downloads section.
export function SettingsScreen() {
  const settings = useSettings();
  const setWifiOnly = useSetWifiOnly();

  return (
    <ScreenFrame title={t('settings.title')}>
      <Text style={[text.sectionLabel, styles.section]}>
        {t('settings.downloads')}
      </Text>
      <View style={styles.card}>
        <SwitchRow
          label={t('settings.wifiOnly')}
          value={settings.data?.wifiOnly ?? true}
          onValueChange={(value) => setWifiOnly.mutate(value)}
        />
        <Text style={[text.secondary, styles.help]}>
          {t('settings.wifiOnlyHelp')}
        </Text>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: spacing.s1, marginBottom: 6 },
  card: {
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.card,
    paddingLeft: spacing.s4,
    paddingRight: 14,
    overflow: 'hidden',
  },
  help: { paddingBottom: spacing.s3 },
});
