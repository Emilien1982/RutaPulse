import { MapScreen } from '@/features/map/MapScreen';
import {
  getZoneDownloader,
  zoneDownloads,
} from '@/features/zones/zoneDownloader';

export default function MapRoute() {
  return (
    <MapScreen
      downloadStore={zoneDownloads}
      onUpdateZone={(zone) => void getZoneDownloader().request(zone)}
    />
  );
}
