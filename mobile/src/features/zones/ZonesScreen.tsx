import { useQuery } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { Alert } from 'react-native';

import { t } from '@/core/i18n/t';
import { buildZoneRows } from '@/core/zones/zoneRow';
import { createZoneOps } from '@/shared-data/zones/createZoneOps';
import {
  useSettings,
  useSetWifiOnly,
} from '@/shared-data/settings/useSettings';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';

import { useCatalogue } from './useCatalogue';
import { getZoneDownloader, zoneDownloads } from './zoneDownloader';
import { ZonesView, type CatalogueStatus } from './ZonesView';

export const zonesTitle = t('tabs.zones');

export function ZonesScreen() {
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

  // Free space is read again whenever the installed zones change.
  const freeSpace = useQuery({
    queryKey: ['zones', 'freeSpace', rows.installedBytes],
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

  function confirmDelete(id: string) {
    const name = rows.installed.find((row) => row.id === id)?.name ?? id;
    Alert.alert(t('zones.deleteTitle', { name }), t('zones.deleteMessage'), [
      { text: t('zones.deleteCancel'), style: 'cancel' },
      {
        text: t('zones.delete'),
        style: 'destructive',
        onPress: () => void getZoneDownloader().remove(id),
      },
    ]);
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
