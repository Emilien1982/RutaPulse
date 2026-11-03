import { RoutesScreen } from '@/features/routes/RoutesScreen';
import { getZoneDownloader } from '@/features/zones/zoneDownloader';

export default function RoutesRoute() {
  return (
    <RoutesScreen
      onDownloadZone={(zone) => void getZoneDownloader().request(zone)}
    />
  );
}
