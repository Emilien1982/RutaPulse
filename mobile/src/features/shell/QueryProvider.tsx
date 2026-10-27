import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import type { ReactNode } from 'react';

// Query learns from expo-network whether the phone is online.
onlineManager.setEventListener((setOnline) => {
  getNetworkStateAsync()
    .then((state) => setOnline(state.isConnected ?? false))
    .catch(() => {});
  const subscription = addNetworkStateListener((state) =>
    setOnline(state.isConnected ?? false),
  );
  return () => subscription.remove();
});

const queryClient = new QueryClient();

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
