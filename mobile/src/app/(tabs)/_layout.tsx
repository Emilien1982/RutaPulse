import { Tabs } from 'expo-router';

import { mapTitle } from '@/features/map/MapScreen';
import { routesTitle } from '@/features/routes/RoutesScreen';
import { settingsTitle } from '@/features/settings/SettingsScreen';
import { zonesTitle } from '@/features/zones/ZonesScreen';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: mapTitle }} />
      <Tabs.Screen name="routes" options={{ title: routesTitle }} />
      <Tabs.Screen name="zones" options={{ title: zonesTitle }} />
      <Tabs.Screen name="settings" options={{ title: settingsTitle }} />
    </Tabs>
  );
}
