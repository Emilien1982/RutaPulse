// What a line of the list says (mockup 40, states 1 and 7a). Pure logic, and
// no calculation beyond formatting: the list must stay light (spec C13).

import { t } from '@/core/i18n/t';
import {
  formatAscent,
  formatDistance,
  formatDuration,
} from '@/core/routing/formatRoute';

import { originText } from './routeText';
import type { RouteZoneStatus } from './routeZone';
import type { RouteSummary } from './savedRoute';

/**
 * The zone case of a line. The track is not read for the list, so `leaves`
 * does not exist here: only the Infos screen tells it.
 */
export function listZoneStatus(
  zoneId: string | null,
  inServiceId: string | null,
  installedIds: readonly string[],
): RouteZoneStatus {
  if (zoneId === null) return 'outside';
  if (!installedIds.includes(zoneId)) return 'deleted';
  return inServiceId === zoneId ? 'usable' : 'notInService';
}

export type RouteLine = {
  distance: string;
  /** " · D+ 421 m · 1 h 35": after the distance, which is in bold. */
  rest: string;
  /** Zone and origin, or the problem that replaces them. */
  meta: string;
  problem: boolean;
  /** The whole line, for a screen reader. */
  label: string;
};

/** The year is shown when the date is not in the current year. */
function originOf(route: RouteSummary, nowYear: number): string {
  const modified =
    route.origin === 'created' && route.savedAt !== route.createdAt;
  const ms = modified ? route.savedAt : route.createdAt;
  return originText(route, new Date(ms).getFullYear() !== nowYear);
}

export function describeRoute(
  route: RouteSummary,
  status: RouteZoneStatus,
  nowYear: number,
): RouteLine {
  const distance = formatDistance(route.distanceKm);
  const ascent =
    route.ascentM === null ? t('route.noFigure') : formatAscent(route.ascentM);
  const duration = formatDuration(route.durationS);
  const zone = route.zoneName ?? '';
  let meta: string;
  if (status === 'outside') meta = t('routes.problemOutside');
  else if (status === 'deleted') meta = t('routes.problemDeleted', { zone });
  else if (status === 'notInService') {
    meta = t('routes.problemNotInService', { zone });
  } else meta = t('routes.meta', { zone, origin: originOf(route, nowYear) });
  return {
    distance,
    rest: t('routes.figuresRest', { ascent, duration }),
    meta,
    problem: status !== 'usable',
    label: t('routes.rowLabel', {
      name: route.name,
      distance,
      ascent: route.ascentM === null ? t('routes.ascentUnknown') : ascent,
      duration,
      meta,
    }),
  };
}
