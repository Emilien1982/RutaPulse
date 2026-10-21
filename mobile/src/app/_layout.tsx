import { Stack } from 'expo-router';

import { titles } from '@/features/navigation/titles';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: titles.settings }} />
    </Stack>
  );
}
