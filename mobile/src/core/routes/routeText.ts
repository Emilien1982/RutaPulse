// Dates and origin of a saved route, as the screens say them (mockup 40).

import { t } from '@/core/i18n/t';
import type { TextKey } from '@/core/i18n/fr';

import type { RouteZoneStatus } from './routeZone';
import type { RouteOrigin } from './savedRoute';

/** "3 nov." or "3 nov. 2026" (local date). */
export function formatRouteDate(ms: number, withYear: boolean): string {
  const date = new Date(ms);
  const day = t('zones.date', {
    day: date.getDate(),
    month: t(`zones.month.${date.getMonth() + 1}` as TextKey),
  });
  return withYear ? `${day} ${date.getFullYear()}` : day;
}

/** True if the route was saved again after its first "Enregistrer". */
export function isResaved(route: {
  createdAt: number;
  savedAt: number;
}): boolean {
  return route.savedAt !== route.createdAt;
}

/** The date that `originText` shows: `savedAt` when the text says "modifié". */
export function originDate(route: {
  origin: RouteOrigin;
  createdAt: number;
  savedAt: number;
}): number {
  if (route.origin === 'gpx') return route.createdAt;
  if (route.origin === 'editedGpx') return route.savedAt;
  return isResaved(route) ? route.savedAt : route.createdAt;
}

/** "créé le …", "modifié le …", "GPX importé le …", "circuit balisé, le …"... */
export function originText(
  route: { origin: RouteOrigin; createdAt: number; savedAt: number },
  withYear: boolean,
): string {
  if (route.origin === 'editedGpx') {
    return t('routes.originGpxModified', {
      date: formatRouteDate(route.savedAt, withYear),
    });
  }
  if (route.origin === 'trail') {
    return isResaved(route)
      ? t('routes.originTrailModified', {
          date: formatRouteDate(route.savedAt, withYear),
        })
      : t('routes.originTrail', {
          date: formatRouteDate(route.createdAt, withYear),
        });
  }
  if (route.origin === 'gpx') {
    return t('routes.originGpx', {
      date: formatRouteDate(route.createdAt, withYear),
    });
  }
  return isResaved(route)
    ? t('routes.originModified', {
        date: formatRouteDate(route.savedAt, withYear),
      })
    : t('routes.originCreated', {
        date: formatRouteDate(route.createdAt, withYear),
      });
}

/** The line under the title of the Infos screen. */
export function zoneLine(
  route: {
    origin: RouteOrigin;
    createdAt: number;
    savedAt: number;
    zone: { name: string } | null;
  },
  status: RouteZoneStatus,
): string {
  const origin = originText(route, true);
  if (status === 'outside' || !route.zone) {
    return t('routes.metaOutside', { origin });
  }
  return t(status === 'deleted' ? 'routes.metaDeleted' : 'routes.meta', {
    zone: route.zone.name,
    origin,
  });
}
