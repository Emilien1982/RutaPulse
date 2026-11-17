import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import {
  useSetBrightness,
  useSettings,
  useSetWifiOnly,
} from '@/shared-data/settings/useSettings';
import { SettingsIcon, SunIcon } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';
import { ScreenFrame } from '@/ui/ScreenFrame';
import { SwitchRow } from '@/ui/SwitchRow';
import { border, colors, radius, spacing, text } from '@/ui/theme';

export const settingsTitle = t('settings.title');

// Screen "Réglages" (mockup 80): the downloads and the tracking sections.
export function SettingsScreen() {
  const settings = useSettings();
  const setWifiOnly = useSetWifiOnly();
  const setBrightness = useSetBrightness();

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
      <Text style={[text.sectionLabel, styles.section, styles.sectionNext]}>
        {t('settings.tracking')}
      </Text>
      <View style={[styles.card, styles.brightness]}>
        <Text style={[text.control, styles.brightnessTitle]}>
          {t('settings.brightness')}
        </Text>
        <Segmented
          variant="cream"
          accessibilityLabel={t('settings.brightness')}
          value={settings.data?.brightness ?? 'auto'}
          onChange={(value) => setBrightness.mutate(value)}
          options={[
            { value: 'auto', label: t('settings.brightnessAuto') },
            {
              value: 'max',
              label: t('settings.brightnessMax'),
              icon: (color, size) => <SunIcon color={color} size={size} />,
            },
          ]}
        />
        <Text style={[text.secondary, styles.brightnessHelp]}>
          <Text style={styles.bold}>{t('settings.brightnessMax')}</Text>
          {t('settings.brightnessHelp')}
        </Text>
        <View style={styles.also}>
          <SettingsIcon color={colors.brown2} size={18} />
          <Text style={text.secondary}>{t('settings.brightnessAlso')}</Text>
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: spacing.s1, marginBottom: 4.5 },
  card: {
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.card,
    paddingLeft: spacing.s4,
    paddingRight: 14,
    overflow: 'hidden',
  },
  sectionNext: { marginTop: spacing.s3 },
  help: { paddingBottom: spacing.s3 },
  brightness: { paddingRight: 16 },
  brightnessTitle: { paddingTop: spacing.s3, paddingBottom: spacing.s2 },
  brightnessHelp: { paddingTop: spacing.s2, paddingBottom: spacing.s3 },
  bold: { fontWeight: '700', color: colors.brown },
  also: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: spacing.s3,
  },
});
