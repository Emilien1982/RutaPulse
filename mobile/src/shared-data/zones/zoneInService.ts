import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import {
  createZoneService,
  type ZoneHold,
  type ZoneInService,
} from '@/core/zones/zoneService';

import { useInstalledZones } from './useInstalledZones';

/** The only zone service of the app (ADR 0018, section 4). */
export const zoneService = createZoneService();

/**
 * Passes each list read from the disk to the service (calling `update` again
 * with the same list changes nothing). Returns false until the disk is read.
 * Declared before the effects of the callers, so the service is up to date
 * when they run.
 */
function useFeedZoneService(): boolean {
  const data = useInstalledZones().data;
  useEffect(() => {
    if (data) zoneService.update(data);
  }, [data]);
  return data !== undefined;
}

/** The zone read by the engine, the map and the Infos screen. */
export function useZoneInService(): ZoneInService {
  const read = useFeedZoneService();
  const zone = useSyncExternalStore(zoneService.subscribe, zoneService.current);
  return read ? zone : undefined;
}

/**
 * Freezes the zone in service while the component is mounted, and returns
 * the zone it holds (undefined before the hold is taken). A screen that
 * reads a zone for a long time takes a hold, so that a new version does not
 * replace the zone under it.
 */
export function useZoneHold(): ZoneInService {
  useFeedZoneService();
  // The hold is taken when React subscribes (after the first render) and
  // given back when it unsubscribes. Strict mode may do this twice: the
  // service counts the holds. If the disk has not been read yet, nothing is
  // held (it would freeze "unknown"): the hold is taken at the first zone.
  const held = useRef<ZoneInService>(undefined);
  const subscribe = useCallback(
    (notify: () => void) => {
      let hold: ZoneHold | null = null;
      let stop = () => {};
      const take = () => {
        hold = zoneService.hold();
        held.current = hold.zone;
        notify();
      };
      if (zoneService.current() !== undefined) {
        take();
      } else {
        stop = zoneService.subscribe(() => {
          if (hold || zoneService.current() === undefined) return;
          stop();
          take();
        });
      }
      return () => {
        stop();
        hold?.release();
        hold = null;
        held.current = undefined;
      };
    },
    [held],
  );
  return useSyncExternalStore(subscribe, () => held.current);
}
