// Altitudes and terrain of each leg, one TanStack Query request per leg and
// per kind (ADR 0017, section 6). The key depends only on the zone, the mode
// and the two points. The draft comes from the Store, which changes only on
// release: nothing is computed during a drag.

import { useQueries } from '@tanstack/react-query';

import type { Draft } from '@/core/draft/draft';
import { trackLengthM } from '@/core/gpx/trackLengthM';
import { thinTrack } from '@/core/routes/track';
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
import {
  heightGroupKey,
  heightGroups,
  joinShapes,
} from '@/core/route-info/heightGroups';
import { infoShape } from '@/core/route-info/legShape';
import type { LegInfo } from '@/core/route-info/routeInfo';
import type { Zone } from '@/core/zones/catalogue';
import {
  computeHeights,
  computeTerrain,
} from '@/shared-data/routing/computeInfos';

import type { LegState } from './useLegResults';

/** Thrown by a query function: an error is never kept in the cache. */
export class InfoError extends Error {
  constructor(readonly kind: RouteErrorKind) {
    super(kind);
  }
}

const MINUTE = 60_000;

export const SETTINGS = {
  staleTime: Infinity,
  gcTime: 30 * MINUTE,
  retry: false,
  networkMode: 'always' as const,
  refetchOnReconnect: false,
};

/** The joined shape of a group, thinned for the engine; null if a leg has none. */
function joinedShape(
  shapes: ([number, number][] | null)[],
): [number, number][] | null {
  const all: [number, number][][] = [];
  for (const shape of shapes) {
    if (shape === null) return null;
    all.push(shape);
  }
  return thinTrack(joinShapes(all));
}

type Slot = { data: unknown; error: unknown } | undefined;

export function failureOf(error: unknown): RouteFailure {
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
  /** The Infos screen only reads: a failed request is not asked again. */
  readOnly = false,
): LegInfo[] {
  const settings = readOnly ? { ...SETTINGS, retryOnMount: false } : SETTINGS;
  const legs = listLegs(draft);
  const plans = legs.map((leg, i) => {
    const state = states[i];
    const route = state?.status === 'done' ? state.result : undefined;
    const trace = state?.status === 'done' && state.trace === true;
    const shape = infoShape(
      leg,
      route && { shape: route.shape, trace },
      zone.bbox,
    );
    // A leg kept from a trace never waits for the engine: no shape means it
    // leaves the zone, and the altitudes are missing.
    const blocked =
      shape === null &&
      (leg.mode === 'hand' || state?.status === 'error' || trace);
    const shapeVersion =
      state?.status === 'done'
        ? (state.shapeVersion ?? zone.version)
        : zone.version;
    return { leg, shape, blocked, shapeVersion, trace };
  });
  // The request of the altitudes of a group of legs.
  function heightQuery(group: number[]) {
    const first = plans[group[0]];
    const { leg, shapeVersion } = first;
    const shape = first.trace
      ? joinedShape(group.map((i) => plans[i].shape))
      : first.shape;
    return {
      queryKey: first.trace
        ? heightGroupKey(
            zone,
            [leg.from, ...group.map((i) => plans[i].leg.to)],
            shapeVersion,
          )
        : legKeyOf('height', leg.mode, plans[group[0]]),
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
      ...settings,
    };
  }

  // The request of the terrain of one leg.
  function terrainQuery(i: number) {
    const plan = plans[i];
    return {
      queryKey: legKeyOf('terrain', 'path', plan),
      queryFn: async ({
        signal,
      }: {
        signal: AbortSignal;
      }): Promise<TerrainEdge[]> => {
        const result = await computeTerrain(plan.shape ?? [], signal);
        if (!result.ok) throw new InfoError(result.error);
        return result.edges;
      },
      enabled: plan.shape !== null,
      ...settings,
    };
  }

  function legKeyOf(
    kind: 'height' | 'terrain',
    mode: string,
    plan: { leg: (typeof plans)[number]['leg']; shapeVersion: number },
  ) {
    const { leg } = plan;
    return [
      'routing',
      kind,
      zone.id,
      zone.version,
      mode,
      leg.from.lon,
      leg.from.lat,
      leg.to.lon,
      leg.to.lat,
      // Version of the zone that drew the shape: a saved shape of v3 and a
      // new one of v4 between the same points are not the same thing.
      leg.mode === 'hand' ? null : plan.shapeVersion,
    ];
  }

  // One altitude request per group of legs (ADR 0020, section 6): a run of
  // legs kept from a trace is one group, any other leg is a group alone.
  const groups = heightGroups(plans);
  const groupOf = new Map<number, number>();
  groups.forEach((group, g) => group.forEach((i) => groupOf.set(i, g)));
  const heightAt: number[] = [];
  const terrainAt: number[] = [];
  const asked: ReturnType<typeof heightQuery | typeof terrainQuery>[] = [];
  groups.forEach((group, g) => {
    heightAt[g] = asked.length;
    asked.push(heightQuery(group));
    for (const i of group) {
      if (plans[i].leg.mode === 'hand') continue;
      terrainAt[i] = asked.length;
      asked.push(terrainQuery(i));
    }
  });
  const queries = useQueries({ queries: asked });
  return plans.map(({ leg, blocked, shape, trace }, i): LegInfo => {
    const slot = (n: number | undefined): Slot => {
      const query = n === undefined ? undefined : queries[n];
      return query && { data: query.data, error: query.error };
    };
    const g = groupOf.get(i) as number;
    const group = groups[g];
    const carrier = group[0] === i;
    const blockedGroup = group.some((j) => plans[j].blocked);
    const read = <T>(s: Slot, build: (data: T) => unknown) => {
      if (blocked || blockedGroup) return failure('failed');
      if (s?.error) return failureOf(s.error);
      if (s?.data !== undefined) return build(s.data as T);
      return undefined;
    };
    return {
      mode: leg.mode,
      handKm: leg.mode === 'hand' ? handLeg(leg.from, leg.to).distanceKm : 0,
      height: carrier
        ? (read<ProfilePoint[]>(slot(heightAt[g]), (profile) => ({
            ok: true,
            profile,
          })) as HeightResult | undefined)
        : { ok: true, profile: [] },
      terrain:
        leg.mode === 'hand'
          ? undefined
          : (read<TerrainEdge[]>(slot(terrainAt[i]), (edges) => ({
              ok: true,
              edges,
            })) as TraceResult | undefined),
      ...(trace && shape ? { shapeLengthM: trackLengthM(shape) } : {}),
      ...(carrier ? {} : { inGroup: true }),
    };
  });
}
