import { Stack } from 'expo-router';

import { FontGate } from '@/features/shell/FontGate';

export default function RootLayout() {
  return (
    <FontGate>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </FontGate>
  );
}
