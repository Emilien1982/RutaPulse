import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { defaultSettings, type Settings } from '@/core/settings/settings';
import type { BrightnessChoice } from '@/core/tracking/brightness';

import { readSettings } from './settingsFile';
import { updateSettings } from './updateSettings';

export const settingsQueryKey = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: readSettings,
    networkMode: 'always',
    placeholderData: defaultSettings,
  });
}

/** Merges into the file, then updates the data read by `useSettings()`. */
function useSetSetting<T>(patchOf: (value: T) => Partial<Settings>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: T) => updateSettings(patchOf(value)),
    networkMode: 'always',
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKey, settings);
    },
  });
}

const wifiOnlyPatch = (wifiOnly: boolean) => ({ wifiOnly });
const brightnessPatch = (brightness: BrightnessChoice) => ({ brightness });

export function useSetWifiOnly() {
  return useSetSetting(wifiOnlyPatch);
}

export function useSetBrightness() {
  return useSetSetting(brightnessPatch);
}
