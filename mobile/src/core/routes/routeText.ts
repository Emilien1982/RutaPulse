// Dates and origin of a saved route, as the screens say them (mockup 40).

import { t } from '@/core/i18n/t';
import type { TextKey } from '@/core/i18n/fr';

import type { RouteZoneStatus } from './routeZone';

/** "3 nov." or "3 nov. 2026" (local date). */
export function formatRouteDate(ms: number, withYear: boolean): string {
  const date = new Date(ms);
  const day = t('zones.date', {
    day: date.getDate(),
    month: t(`zones.month.${date.getMonth() + 1}` as TextKey),
  });
  return withYear ? `${day} ${date.getFullYear()}` : day;
}

/** "créé le …", "modifié le …" (saved again) or "GPX importé le …". */
export function originText(
  route: { origin: 'created' | 'gpx'; createdAt: number; savedAt: number },
  withYear: boolean,
): string {
  if (route.origin === 'gpx') {
    return t('routes.originGpx', {
      date: formatRouteDate(route.createdAt, withYear),
    });
  }
  return route.savedAt !== route.createdAt
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
    origin: 'created' | 'gpx';
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
