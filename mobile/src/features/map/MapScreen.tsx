import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { t } from '@/core/i18n/t';
import { useZoneInService } from '@/shared-data/zones/zoneInService';
import { colors } from '@/ui/theme';

import { EmptyMap } from './EmptyMap';
import { useGlyphsReady } from './useGlyphsReady';
import { ZoneMap } from './ZoneMap';

export const mapTitle = t('tabs.map');

export function MapScreen() {
  const router = useRouter();
  const zone = useZoneInService();
  const glyphsReady = useGlyphsReady();

  // Nothing is drawn until the disk has been read: no flash of the empty state.
  if (zone === undefined) {
    return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
  }
  if (!zone) {
    return <EmptyMap onChooseZone={() => router.navigate('/zones')} />;
  }
  if (!glyphsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
  }
  return <ZoneMap key={`${zone.id}-${zone.version}`} zone={zone} />;
}
