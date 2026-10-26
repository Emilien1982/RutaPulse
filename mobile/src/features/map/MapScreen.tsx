import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { t } from '@/core/i18n/t';
import { pickActiveZone } from '@/core/zones/activeZone';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';
import { colors } from '@/ui/theme';

import { EmptyMap } from './EmptyMap';
import { useGlyphsReady } from './useGlyphsReady';
import { ZoneMap } from './ZoneMap';

export const mapTitle = t('tabs.map');

export function MapScreen() {
  const router = useRouter();
  const installed = useInstalledZones();
  const glyphsReady = useGlyphsReady();

  // Nothing is drawn until the disk has been read: no flash of the empty state.
  if (!installed.data) {
    return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
  }
  const zone = pickActiveZone(installed.data);
  if (!zone) {
    return <EmptyMap onChooseZone={() => router.navigate('/zones')} />;
  }
  if (!glyphsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
  }
  return <ZoneMap key={`${zone.id}-${zone.version}`} zone={zone} />;
}
