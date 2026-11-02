import { useIsFocused } from 'expo-router';

import { ZonesScreen } from '@/features/zones/ZonesScreen';

export default function Zones() {
  return <ZonesScreen focused={useIsFocused()} />;
}
