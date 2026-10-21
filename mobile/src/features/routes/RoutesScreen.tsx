import { Text, View } from 'react-native';

import { t } from '@/core/i18n/t';

export function RoutesScreen() {
  return (
    <View>
      <Text>{t('tabs.routes')}</Text>
    </View>
  );
}
