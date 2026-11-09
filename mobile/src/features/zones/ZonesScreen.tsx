import { useQueries, useQuery } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { t } from '@/core/i18n/t';
import { buildZoneRows } from '@/core/zones/zoneRow';
import { routeCountByZoneOptions } from '@/shared-data/routes/useRoutes';
import { createZoneOps } from '@/shared-data/zones/createZoneOps';
import { useCatalogue } from '@/shared-data/zones/useCatalogue';
import {
  useSettings,
  useSetWifiOnly,
} from '@/shared-data/settings/useSettings';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';

import { getZoneDownloader, zoneDownloads } from './zoneDownloader';
import { ZonesView, type CatalogueStatus } from './ZonesView';

export const zonesTitle = t('tabs.zones');

// `focused`: the tab is in front (the route file knows it); a screen reader
// hears "zone updated" only then.
export function ZonesScreen({ focused = true }: { focused?: boolean }) {
  const catalogue = useCatalogue();
  const installed = useInstalledZones();
  const downloads = useSelector(zoneDownloads);
  const settings = useSettings();
  const setWifiOnly = useSetWifiOnly();

  const rows = buildZoneRows(
    catalogue.data?.zones ?? [],
    installed.data ?? [],
    downloads,
  );

  // A screen reader hears it when a zone has just been updated (mockup 41).
  const versions = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (!installed.data) return;
    const known = versions.current;
    const next = new Map<string, number>();
    for (const { zone } of installed.data) {
      next.set(zone.id, Math.max(next.get(zone.id) ?? 0, zone.version));
    }
    for (const [id, version] of next) {
      const before = known?.get(id);
      const name = installed.data.find((m) => m.zone.id === id)?.zone.name;
      if (focused && before !== undefined && version > before && name) {
        AccessibilityInfo.announceForAccessibility(
          t('zones.updated', { name }),
        );
      }
    }
    versions.current = next;
    // `focused` is read, not watched: a change of focus announces nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed.data]);

  // Free space is read again after each reading of the disk: an old version
  // erased after a switch frees room that `installedBytes` does not show.
  const freeSpace = useQuery({
    queryKey: ['zones', 'freeSpace', installed.dataUpdatedAt],
    queryFn: () => createZoneOps().availableSpace(),
    networkMode: 'always',
  });

  // Without network, Query pauses the request instead of failing.
  const status: CatalogueStatus = catalogue.isSuccess
    ? 'ready'
    : catalogue.isError || catalogue.fetchStatus === 'paused'
      ? 'error'
      : 'loading';

  function download(id: string) {
    const zone = catalogue.data?.zones.find((z) => z.id === id);
    if (zone) void getZoneDownloader().request(zone);
  }

  // How many saved routes each installed zone holds, read before the
  // question of the deletion (ADR 0019, section 13, point 8). Not read yet,
  // or not readable: no sentence.
  const installedIds = rows.installed.map((row) => row.id);
  const routeCounts = useQueries({
    queries: installedIds.map(routeCountByZoneOptions),
    combine: (results) =>
      new Map(results.map((r, i) => [installedIds[i], r.data ?? 0])),
  });

  function confirmDelete(id: string) {
    const name = rows.installed.find((row) => row.id === id)?.name ?? id;
    const count = routeCounts.get(id) ?? 0;
    const routes =
      count === 0
        ? ''
        : `\n\n${t(count === 1 ? 'zones.deleteRoutesOne' : 'zones.deleteRoutes', { n: count })}`;
    Alert.alert(
      t('zones.deleteTitle', { name }),
      t('zones.deleteMessage') + routes,
      [
        { text: t('zones.deleteCancel'), style: 'cancel' },
        {
          text: t('zones.delete'),
          style: 'destructive',
          onPress: () => void getZoneDownloader().remove(id),
        },
      ],
    );
  }

  return (
    <ZonesView
      rows={rows}
      catalogue={status}
      onReloadCatalogue={() => void catalogue.refetch()}
      freeBytes={freeSpace.data ?? null}
      wifiOnly={settings.data?.wifiOnly ?? true}
      onWifiOnlyChange={(value) => setWifiOnly.mutate(value)}
      onDownload={download}
      onCancel={(id) => void getZoneDownloader().cancel(id)}
      onRetry={(id) => getZoneDownloader().retry(id)}
      onMenu={confirmDelete}
    />
  );
}
