import { Link, Tabs } from 'expo-router';

import { titles } from '@/features/navigation/titles';

function SettingsLink() {
  return <Link href="/settings">{titles.settings}</Link>;
}

export default function TabsLayout() {
  const headerRight = SettingsLink;
  return (
    <Tabs screenOptions={{ headerRight }}>
      <Tabs.Screen name="index" options={{ title: titles.map }} />
      <Tabs.Screen name="routes" options={{ title: titles.routes }} />
      <Tabs.Screen name="zones" options={{ title: titles.zones }} />
    </Tabs>
  );
}
