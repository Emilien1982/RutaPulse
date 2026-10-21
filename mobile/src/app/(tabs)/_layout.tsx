import { Link, Tabs } from 'expo-router';

import { mapTitle } from '@/features/map/MapScreen';
import { routesTitle } from '@/features/routes/RoutesScreen';
import { settingsTitle } from '@/features/settings/SettingsScreen';
import { zonesTitle } from '@/features/zones/ZonesScreen';

function SettingsLink() {
  return <Link href="/settings">{settingsTitle}</Link>;
}

export default function TabsLayout() {
  const headerRight = SettingsLink;
  return (
    <Tabs screenOptions={{ headerRight }}>
      <Tabs.Screen name="index" options={{ title: mapTitle }} />
      <Tabs.Screen name="routes" options={{ title: routesTitle }} />
      <Tabs.Screen name="zones" options={{ title: zonesTitle }} />
    </Tabs>
  );
}
