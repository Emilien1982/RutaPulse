import { Text, View } from 'react-native';

import { t } from '@/core/i18n/t';

export function MapScreen() {
  return (
    <View>
      <Text>{t('tabs.map')}</Text>
    </View>
  );
}
