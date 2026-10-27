import { Tabs } from 'expo-router';

import { mapTitle } from '@/features/map/MapScreen';
import { routesTitle } from '@/features/routes/RoutesScreen';
import { settingsTitle } from '@/features/settings/SettingsScreen';
import {
  tabIcons,
  useTabScreenOptions,
} from '@/features/shell/tabScreenOptions';
import { zonesTitle } from '@/features/zones/ZonesScreen';

export default function TabsLayout() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{ title: mapTitle, tabBarIcon: tabIcons.map }}
      />
      <Tabs.Screen
        name="routes"
        options={{ title: routesTitle, tabBarIcon: tabIcons.routes }}
      />
      <Tabs.Screen
        name="zones"
        options={{ title: zonesTitle, tabBarIcon: tabIcons.zones }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: settingsTitle, tabBarIcon: tabIcons.settings }}
      />
    </Tabs>
  );
}
