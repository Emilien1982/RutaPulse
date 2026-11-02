import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { removeOldVersions } from '@/core/zones/installedZones';
import { createZoneOps } from '@/shared-data/zones/createZoneOps';

import {
  installedZonesQueryKey,
  useInstalledZones,
} from '@/shared-data/zones/useInstalledZones';
import { zoneService } from '@/shared-data/zones/zoneInService';

import { routingEngine } from './routingEngine';

/**
 * Feeds the zone service with each reading of the disk, and keeps the engine
 * open on the zone in service. Once the engine has left the old version, the
 * old versions are erased (ADR 0018, section 4).
 */
export function useRoutingEngine(): void {
  const installed = useInstalledZones();
  const queryClient = useQueryClient();
  const data = installed.data;

  // Declared first: the first `update` below must find the listener.
  useEffect(() => {
    return zoneService.subscribe(() => {
      const zone = zoneService.current();
      if (zone === undefined) return;
      // No `await` between the switch and `setZone`: same step of JavaScript.
      void routingEngine
        .setZone(zone)
        .then(() => removeOldVersions(createZoneOps(), zoneService))
        .catch(() => undefined)
        .then(() =>
          queryClient.invalidateQueries({ queryKey: installedZonesQueryKey }),
        );
    });
  }, [queryClient]);

  useEffect(() => {
    // Wait for the first reading: an unknown list is not "no zone".
    if (data) zoneService.update(data);
  }, [data]);
}
