import { useEffect } from 'react';

import { pickActiveZone } from '@/core/zones/activeZone';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';

import { routingEngine } from './routingEngine';

/** Keeps the engine open on the zone shown by the map. */
export function useRoutingEngine(): void {
  const installed = useInstalledZones();
  const data = installed.data;

  useEffect(() => {
    // Wait for the first reading: an unknown list is not "no zone".
    if (!data) return;
    routingEngine.setZone(pickActiveZone(data));
  }, [data]);
}
