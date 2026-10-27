import { Stack } from 'expo-router';

import { AppStatusBar } from '@/features/shell/AppStatusBar';
import { FontGate } from '@/features/shell/FontGate';
import { QueryProvider } from '@/features/shell/QueryProvider';
import { RoutingEngineStarter } from '@/features/shell/RoutingEngineStarter';
import { ZoneDownloaderStarter } from '@/features/zones/ZoneDownloaderStarter';

export default function RootLayout() {
  return (
    <QueryProvider>
      <FontGate>
        <AppStatusBar />
        <ZoneDownloaderStarter />
        <RoutingEngineStarter />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </FontGate>
    </QueryProvider>
  );
}
