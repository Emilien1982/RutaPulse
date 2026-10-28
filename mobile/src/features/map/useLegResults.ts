// One engine request per 'path' leg (ADR 0016, section 3). The key depends
// only on the zone and the two points, so "undo" finds results in the cache.

import { useQueries } from '@tanstack/react-query';

import type { Draft } from '@/core/draft/draft';
import { handLeg, listLegs, type LegResult } from '@/core/draft/legs';
import type {
  RouteErrorKind,
  RouteSuccess,
} from '@/core/routing/routeResponse';
import type { Zone } from '@/core/zones/catalogue';
import { computeRoute } from '@/shared-data/routing/computeRoute';

/** Thrown by the query function: keeps the kind of the engine error. */
export class LegError extends Error {
  constructor(readonly kind: RouteErrorKind) {
    super(kind);
  }
}

/** State of one leg, in the order of `draft.modes`. */
export type LegState =
  | { status: 'hand'; result: LegResult }
  | { status: 'pending' }
  | { status: 'done'; result: RouteSuccess }
  | { status: 'error'; error: RouteErrorKind };

const MINUTE = 60_000;

export function useLegResults(
  draft: Draft,
  zone: Pick<Zone, 'id' | 'version'>,
): LegState[] {
  const legs = listLegs(draft);
  const pathLegs = legs.filter((leg) => leg.mode === 'path');
  const queries = useQueries({
    queries: pathLegs.map(({ from, to }) => ({
      queryKey: [
        'routing',
        'leg',
        zone.id,
        zone.version,
        'path',
        from.lon,
        from.lat,
        to.lon,
        to.lat,
      ],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const result = await computeRoute([from, to], signal);
        if (!result.ok) throw new LegError(result.error);
        return result;
      },
      staleTime: Infinity,
      gcTime: 30 * MINUTE,
      retry: false,
      networkMode: 'always' as const,
      refetchOnReconnect: false,
    })),
  });
  let next = 0;
  return legs.map((leg): LegState => {
    if (leg.mode === 'hand') {
      return { status: 'hand', result: handLeg(leg.from, leg.to) };
    }
    const query = queries[next++];
    if (query?.data) return { status: 'done', result: query.data };
    if (query?.error) {
      const error = query.error;
      return {
        status: 'error',
        error: error instanceof LegError ? error.kind : 'failed',
      };
    }
    return { status: 'pending' };
  });
}
