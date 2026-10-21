import { Stack } from 'expo-router';

import { settingsTitle } from '@/features/settings/SettingsScreen';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: settingsTitle }} />
    </Stack>
  );
}
