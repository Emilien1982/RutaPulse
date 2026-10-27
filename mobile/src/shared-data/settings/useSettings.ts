import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { defaultSettings } from '@/core/settings/settings';

import { readSettings, writeSettings } from './settingsFile';

export const settingsQueryKey = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: readSettings,
    networkMode: 'always',
    placeholderData: defaultSettings,
  });
}

/** Writes the file, then updates the data read by `useSettings()`. */
export function useSetWifiOnly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (wifiOnly: boolean) => {
      await writeSettings({ wifiOnly });
      return { wifiOnly };
    },
    networkMode: 'always',
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKey, settings);
    },
  });
}
