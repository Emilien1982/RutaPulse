// The waymarked circuits of a zone version (ADR 0020, section 9). One
// reading of `trails.geojson` per version, kept in memory for the life of
// the app. An unreadable file gives an empty list: the map has no circuits.

import { useQuery } from '@tanstack/react-query';

import { parseTrails, type Trail } from '@/core/trails/trails';
import type { Zone } from '@/core/zones/catalogue';
import { filePath, TRAILS_FILE } from '@/core/zones/zoneLayout';
import { createZoneOps } from '@/shared-data/zones/createZoneOps';

const NO_TRAILS: Trail[] = [];

/** Undefined while the file is being read. */
export function useTrails(zone: Zone): Trail[] | undefined {
  const query = useQuery({
    queryKey: ['zones', 'trails', zone.id, zone.version],
    queryFn: async (): Promise<Trail[]> => {
      try {
        const text = await createZoneOps().readText(
          filePath(zone, { path: TRAILS_FILE }),
        );
        return parseTrails(text);
      } catch {
        return NO_TRAILS;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    networkMode: 'always',
  });
  return query.data;
}
