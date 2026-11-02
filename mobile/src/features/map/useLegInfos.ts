// Altitudes and terrain of each leg, one TanStack Query request per leg and
// per kind (ADR 0017, section 6). The key depends only on the zone, the mode
// and the two points. The draft comes from the Store, which changes only on
// release: nothing is computed during a drag.

import { useQueries } from '@tanstack/react-query';

import type { Draft } from '@/core/draft/draft';
import { handLeg, listLegs } from '@/core/draft/legs';
import {
  type HeightResult,
  type ProfilePoint,
  type TerrainEdge,
  type TraceResult,
} from '@/core/routing/infoResponse';
import {
  failure,
  type RouteErrorKind,
  type RouteFailure,
} from '@/core/routing/routeResponse';
import { infoShape } from '@/core/route-info/legShape';
import type { LegInfo } from '@/core/route-info/routeInfo';
import type { Zone } from '@/core/zones/catalogue';
import {
  computeHeights,
  computeTerrain,
} from '@/shared-data/routing/computeInfos';

import type { LegState } from './useLegResults';

/** Thrown by a query function: an error is never kept in the cache. */
class InfoError extends Error {
  constructor(readonly kind: RouteErrorKind) {
    super(kind);
  }
}

const MINUTE = 60_000;

const SETTINGS = {
  staleTime: Infinity,
  gcTime: 30 * MINUTE,
  retry: false,
  networkMode: 'always' as const,
  refetchOnReconnect: false,
};

type Slot = { data: unknown; error: unknown } | undefined;

function failureOf(error: unknown): RouteFailure {
  return failure(error instanceof InfoError ? error.kind : 'failed');
}

/**
 * `states` are the results of the routes, in the order of the legs. Each
 * leg gives `undefined` while its request is not finished, and a failure
 * when it will never run (route failed, hand leg outside the zone).
 */
export function useLegInfos(
  draft: Draft,
  zone: Pick<Zone, 'id' | 'version' | 'bbox'>,
  states: LegState[],
): LegInfo[] {
  const legs = listLegs(draft);
  const plans = legs.map((leg, i) => {
    const state = states[i];
    const route = state?.status === 'done' ? state.result : undefined;
    const shape = infoShape(leg, route, zone.bbox);
    const blocked =
      shape === null && (leg.mode === 'hand' || state?.status === 'error');
    return { leg, shape, blocked };
  });
  const queries = useQueries({
    queries: plans.flatMap(({ leg, shape }) => {
      const key = (kind: 'height' | 'terrain', mode: string) => [
        'routing',
        kind,
        zone.id,
        zone.version,
        mode,
        leg.from.lon,
        leg.from.lat,
        leg.to.lon,
        leg.to.lat,
      ];
      const heights = {
        queryKey: key('height', leg.mode),
        queryFn: async ({
          signal,
        }: {
          signal: AbortSignal;
        }): Promise<ProfilePoint[]> => {
          const result = await computeHeights(shape ?? [], signal);
          if (!result.ok) throw new InfoError(result.error);
          return result.profile;
        },
        enabled: shape !== null,
        ...SETTINGS,
      };
      if (leg.mode === 'hand') return [heights];
      const terrain = {
        queryKey: key('terrain', 'path'),
        queryFn: async ({
          signal,
        }: {
          signal: AbortSignal;
        }): Promise<TerrainEdge[]> => {
          const result = await computeTerrain(shape ?? [], signal);
          if (!result.ok) throw new InfoError(result.error);
          return result.edges;
        },
        enabled: shape !== null,
        ...SETTINGS,
      };
      return [heights, terrain];
    }),
  });
  let next = 0;
  return plans.map(({ leg, blocked }): LegInfo => {
    const slot = (): Slot => {
      const query = queries[next++];
      return query && { data: query.data, error: query.error };
    };
    const heightSlot = slot();
    const terrainSlot = leg.mode === 'path' ? slot() : undefined;
    const read = <T>(s: Slot, build: (data: T) => unknown) => {
      if (blocked) return failure('failed');
      if (s?.error) return failureOf(s.error);
      if (s?.data !== undefined) return build(s.data as T);
      return undefined;
    };
    return {
      mode: leg.mode,
      handKm: leg.mode === 'hand' ? handLeg(leg.from, leg.to).distanceKm : 0,
      height: read<ProfilePoint[]>(heightSlot, (profile) => ({
        ok: true,
        profile,
      })) as HeightResult | undefined,
      terrain:
        leg.mode === 'hand'
          ? undefined
          : (read<TerrainEdge[]>(terrainSlot, (edges) => ({
              ok: true,
              edges,
            })) as TraceResult | undefined),
    };
  });
}
