import { Text, View } from 'react-native';

import { t } from '@/core/i18n/t';

export const settingsTitle = t('settings.title');

export function SettingsScreen() {
  return (
    <View>
      <Text>{t('settings.title')}</Text>
    </View>
  );
}
