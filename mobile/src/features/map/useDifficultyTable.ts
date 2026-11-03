// The difficulty table of a zone version (ADR 0018, section 2). One request
// per version, kept in memory for the life of the app. A zone without the
// file, or an unreadable file, gives an empty table: everything is unknown.

import { useQuery } from '@tanstack/react-query';

import {
  parseDifficultyTable,
  type DifficultyTable,
} from '@/core/route-info/difficulty';
import type { Zone } from '@/core/zones/catalogue';
import {
  DIFFICULTY_FILE,
  filePath,
  hasDifficultyTable,
} from '@/core/zones/zoneLayout';
import { createZoneOps } from '@/shared-data/zones/createZoneOps';

const EMPTY_TABLE = parseDifficultyTable(null);

/** Undefined while the file is being read. */
export function useDifficultyTable(zone: Zone): DifficultyTable | undefined {
  const query = useQuery({
    queryKey: ['zones', 'difficulty', zone.id, zone.version],
    queryFn: async (): Promise<DifficultyTable> => {
      if (!hasDifficultyTable(zone)) return EMPTY_TABLE;
      try {
        const text = await createZoneOps().readText(
          filePath(zone, { path: DIFFICULTY_FILE }),
        );
        return parseDifficultyTable(text);
      } catch {
        return EMPTY_TABLE;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    networkMode: 'always',
  });
  return query.data;
}
