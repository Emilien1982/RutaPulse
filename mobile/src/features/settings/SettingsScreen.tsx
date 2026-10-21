import { Text, View } from 'react-native';

import { t } from '@/core/i18n/t';

export function SettingsScreen() {
  return (
    <View>
      <Text>{t('settings.title')}</Text>
    </View>
  );
}
