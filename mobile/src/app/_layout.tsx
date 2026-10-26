import { Stack } from 'expo-router';

import { FontGate } from '@/features/shell/FontGate';
import { QueryProvider } from '@/features/shell/QueryProvider';
import { ZoneDownloaderStarter } from '@/features/zones/ZoneDownloaderStarter';

export default function RootLayout() {
  return (
    <QueryProvider>
      <FontGate>
        <ZoneDownloaderStarter />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </FontGate>
    </QueryProvider>
  );
}
