import { useQuery } from '@tanstack/react-query';

import { scanZones } from '@/core/zones/installedZones';

import { createZoneOps } from './createZoneOps';

export const installedZonesQueryKey = ['zones', 'installed'] as const;

/** Ready zones, read from the markers on the disk. Works without network. */
export function useInstalledZones() {
  return useQuery({
    queryKey: installedZonesQueryKey,
    queryFn: async () => (await scanZones(createZoneOps(), false)).installed,
    networkMode: 'always',
  });
}
