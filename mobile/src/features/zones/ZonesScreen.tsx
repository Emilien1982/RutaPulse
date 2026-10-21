import { Text, View } from 'react-native';

import { t } from '@/core/i18n/t';

export function ZonesScreen() {
  return (
    <View>
      <Text>{t('tabs.zones')}</Text>
    </View>
  );
}
