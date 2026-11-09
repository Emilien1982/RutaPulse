// Saved routes read by TanStack Query, and the writes that invalidate them
// (ADR 0019, section 10).

import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  attachZone,
  countRoutesByZone,
  deleteRoute,
  duplicateRoute,
  getRoute,
  insertRoute,
  listRoutes,
  newDefaultName,
  renameRoute,
  replaceRoute,
  updateFigures,
  type ReplaceInput,
} from '@/core/routes/routeRepo';
import type { NewRoute } from '@/core/routes/savedRoute';

import { getRoutesDb } from './routesDb';

export const routesKey = ['routes'] as const;
export const routesListKey = ['routes', 'list'] as const;
export const routeDetailKey = (id: number) => ['routes', 'detail', id] as const;
export const routeCountByZoneKey = (zoneId: string) =>
  ['routes', 'countByZone', zoneId] as const;

// Only the app writes in the database, and each write invalidates what it
// changes: the data never goes stale by itself.
const READ_OPTIONS = {
  staleTime: Infinity,
  networkMode: 'always',
  retry: false,
} as const;

export function useRoutes() {
  return useQuery({
    queryKey: routesListKey,
    queryFn: async () => listRoutes(await getRoutesDb()),
    ...READ_OPTIONS,
  });
}

/** `data` is null when there is no such route. No read while `id` is null. */
export function useSavedRoute(id: number | null) {
  return useQuery({
    queryKey: ['routes', 'detail', id],
    queryFn: async () =>
      id === null ? null : getRoute(await getRoutesDb(), id),
    enabled: id !== null,
    ...READ_OPTIONS,
  });
}

/** Options of the count, for `useQuery` and for `useQueries`. */
export const routeCountByZoneOptions = (zoneId: string) => ({
  queryKey: routeCountByZoneKey(zoneId),
  queryFn: async () => countRoutesByZone(await getRoutesDb(), zoneId),
  ...READ_OPTIONS,
});

export function useRouteCountByZone(zoneId: string) {
  return useQuery(routeCountByZoneOptions(zoneId));
}

/** A new route: the name is optional (default name), dates default to now. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type CreateRouteInput = DistributiveOmit<
  NewRoute,
  'name' | 'createdAt' | 'savedAt'
> & {
  name?: string;
  /** Default name before "(2)", instead of "Itinéraire du 9 nov.". */
  baseName?: string;
  now?: number;
};

export function createRouteActions(queryClient: QueryClient) {
  return {
    /** Returns the id of the new route. */
    create: async ({ name, baseName, now, ...rest }: CreateRouteInput) => {
      const db = await getRoutesDb();
      const date = new Date(now ?? Date.now());
      const route = {
        ...rest,
        name: name ?? (await newDefaultName(db, date, baseName)),
        createdAt: date.getTime(),
        savedAt: date.getTime(),
      };
      const id = await insertRoute(db, route);
      await queryClient.invalidateQueries({ queryKey: routesKey });
      return id;
    },
    replace: async (id: number, input: ReplaceInput) => {
      const changed = await replaceRoute(await getRoutesDb(), id, input);
      await queryClient.invalidateQueries({ queryKey: routesKey });
      return changed;
    },
    rename: async (id: number, name: string) => {
      const changed = await renameRoute(await getRoutesDb(), id, name);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: routesListKey }),
        queryClient.invalidateQueries({ queryKey: routeDetailKey(id) }),
      ]);
      return changed;
    },
    /** Returns the id and the name of the copy, or null if the route is gone. */
    duplicate: async (id: number, now: number = Date.now()) => {
      const db = await getRoutesDb();
      const copyId = await duplicateRoute(db, id, now);
      await queryClient.invalidateQueries({ queryKey: routesKey });
      if (copyId === null) return null;
      const copy = await getRoute(db, copyId);
      return { id: copyId, name: copy?.name ?? '' };
    },
    remove: async (id: number) => {
      const changed = await deleteRoute(await getRoutesDb(), id);
      queryClient.removeQueries({ queryKey: routeDetailKey(id) });
      await queryClient.invalidateQueries({ queryKey: routesKey });
      return changed;
    },
    /** A GPX without zone takes the zone in service. */
    attachZone: async (
      id: number,
      zone: { id: string; version: number; name: string },
    ) => {
      const changed = await attachZone(await getRoutesDb(), id, zone);
      if (changed) await queryClient.invalidateQueries({ queryKey: routesKey });
      return changed;
    },
    /** Only the list is invalidated: the Infos screen has its figures. */
    updateFigures: async (
      id: number,
      ascentM: number | null,
      descentM: number | null,
      now: number = Date.now(),
    ) => {
      const changed = await updateFigures(
        await getRoutesDb(),
        id,
        ascentM,
        descentM,
        now,
      );
      await queryClient.invalidateQueries({ queryKey: routesListKey });
      return changed;
    },
  };
}

export function useRouteActions() {
  const queryClient = useQueryClient();
  return useMemo(() => createRouteActions(queryClient), [queryClient]);
}
