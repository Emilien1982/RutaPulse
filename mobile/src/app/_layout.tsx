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
          {/* Creation of a route: full screen, no tab bar (ADR 0016, section 6). */}
          <Stack.Screen
            name="draft"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          {/* Infos of a saved route (ADR 0019, section 3). */}
          <Stack.Screen name="route/[id]" options={{ headerShown: false }} />
        </Stack>
      </FontGate>
    </QueryProvider>
  );
}
