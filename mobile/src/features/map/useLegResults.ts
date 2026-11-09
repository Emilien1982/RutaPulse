// One engine request per 'path' leg (ADR 0016, section 3). The key depends
// only on the zone and the two points, so "undo" finds results in the cache.

import { useQueries } from '@tanstack/react-query';

import type { Draft } from '@/core/draft/draft';
import { legKey, type KeptLegs } from '@/core/routes/reopen';
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
  | {
      status: 'done';
      result: RouteSuccess;
      /** Version of the zone that calculated the shape (default: the zone). */
      shapeVersion?: number;
      /** The shape is a kept piece of a trace, not from the engine. */
      trace?: true;
    }
  | { status: 'error'; error: RouteErrorKind };

const MINUTE = 60_000;

export function useLegResults(
  draft: Draft,
  zone: Pick<Zone, 'id' | 'version'>,
  /** Saved shapes (ADR 0019, section 4): a leg with the same two ends takes
   * its saved shape, with no calculation. */
  kept?: KeptLegs,
): LegState[] {
  const legs = listLegs(draft);
  type End = { lon: number; lat: number };
  const keptOf = (leg: { from: End; to: End }) =>
    kept?.get(legKey(leg.from, leg.to));
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
      enabled: !keptOf({ from, to }),
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
    const saved = keptOf(leg);
    if (saved) {
      return {
        status: 'done',
        result: saved,
        shapeVersion: saved.zoneVersion,
        ...(saved.trace ? { trace: true as const } : {}),
      };
    }
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

// True when the two lists draw the same thing: the screen then keeps the old
// list, and what depends on it is not computed again.
export function sameLegs(a: LegState[], b: LegState[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      if (!y || x.status !== y.status) return false;
      if (x.status === 'done' && y.status === 'done') {
        return x.result === y.result;
      }
      if (x.status === 'hand' && y.status === 'hand') {
        return (
          x.result.distanceKm === y.result.distanceKm &&
          x.result.durationS === y.result.durationS
        );
      }
      if (x.status === 'error' && y.status === 'error') {
        return x.error === y.error;
      }
      return true;
    })
  );
}
