import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { fontAssets } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

// Shows the app only once the Jost font is loaded. If loading fails, the app
// still opens (titles then use the system font).
export function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts(fontAssets);
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return ready ? children : null;
}
