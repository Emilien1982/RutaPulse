import { Text, View } from 'react-native';

import { t } from '@/core/i18n/t';

export const zonesTitle = t('tabs.zones');

export function ZonesScreen() {
  return (
    <View>
      <Text>{t('tabs.zones')}</Text>
    </View>
  );
}
