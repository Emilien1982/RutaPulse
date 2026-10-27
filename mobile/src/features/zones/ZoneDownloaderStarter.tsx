import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { createZoneOps } from '@/shared-data/zones/createZoneOps';
import { installedZonesQueryKey } from '@/shared-data/zones/useInstalledZones';

import { createZoneDownloader, setZoneDownloader } from './zoneDownloader';

// No display. Starts the downloader once, and resumes the downloads that a
// closed app left on the disk (ADR 0013, section 4).
export function ZoneDownloaderStarter() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const downloader = createZoneDownloader(createZoneOps(), () =>
      queryClient.invalidateQueries({ queryKey: installedZonesQueryKey }),
    );
    setZoneDownloader(downloader);
    void downloader.resumeInterrupted();
    return () => setZoneDownloader(null);
  }, [queryClient]);

  return null;
}
