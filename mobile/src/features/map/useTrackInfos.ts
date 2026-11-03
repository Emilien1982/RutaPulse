// Altitudes and terrain of an imported GPX (ADR 0019, section 5): the whole
// track counts as one calculated leg, thinned to what the engine accepts.
// The saved track never changes.

import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { ProfilePoint, TerrainEdge } from '@/core/routing/infoResponse';
import type { LegInfo } from '@/core/route-info/routeInfo';
import type { GpxRoute } from '@/core/routes/savedRoute';
import { thinTrack } from '@/core/routes/track';
import type { Zone } from '@/core/zones/catalogue';
import {
  computeHeights,
  computeTerrain,
} from '@/shared-data/routing/computeInfos';

import { failure } from '@/core/routing/routeResponse';
import { failureOf, InfoError, SETTINGS } from './useLegInfos';

/** One `LegInfo`; the engine is asked only when `enabled`. */
export function useTrackInfos(
  route: GpxRoute,
  zone: Pick<Zone, 'id' | 'version'>,
  enabled: boolean,
): LegInfo[] {
  const shape = useMemo(() => thinTrack(route.track), [route.track]);
  const settings = { ...SETTINGS, retryOnMount: false, enabled };
  const key = (kind: 'height' | 'terrain') => [
    'routing',
    kind,
    zone.id,
    zone.version,
    'track',
    route.id,
  ];
  const [heights, terrain] = useQueries({
    queries: [
      {
        queryKey: key('height'),
        queryFn: async ({
          signal,
        }: {
          signal: AbortSignal;
        }): Promise<ProfilePoint[]> => {
          const result = await computeHeights(shape, signal);
          if (!result.ok) throw new InfoError(result.error);
          return result.profile;
        },
        ...settings,
      },
      {
        queryKey: key('terrain'),
        queryFn: async ({
          signal,
        }: {
          signal: AbortSignal;
        }): Promise<TerrainEdge[]> => {
          const result = await computeTerrain(shape, signal);
          if (!result.ok) throw new InfoError(result.error);
          return result.edges;
        },
        ...settings,
      },
    ],
  });
  return [
    {
      mode: 'path',
      handKm: 0,
      height: !enabled
        ? failure('failed')
        : heights?.error
          ? failureOf(heights.error)
          : heights?.data
            ? { ok: true, profile: heights.data }
            : undefined,
      terrain: !enabled
        ? failure('failed')
        : terrain?.error
          ? failureOf(terrain.error)
          : terrain?.data
            ? { ok: true, edges: terrain.data }
            : undefined,
    },
  ];
}
