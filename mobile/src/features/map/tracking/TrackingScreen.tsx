// The tracking of a saved route, at /tracking/[id] (ADR 0021, section 5.5).
// It loads the route and its zone, builds the line to follow, and hands over
// to the session. The ascent left comes from the profile of the Infos screen,
// under the same cache keys: no new call to the engine (section 4).

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { summarizeInfo } from '@/core/route-info/routeInfo';
import { reopenDraft } from '@/core/routes/reopen';
import { canAttachZone, routeZoneStatus } from '@/core/routes/routeZone';
import type { CreatedRoute, GpxRoute } from '@/core/routes/savedRoute';
import { climbProfile } from '@/core/tracking/remaining';
import {
  sourceOfCreated,
  sourceOfGpx,
  type TrackingSource,
} from '@/core/tracking/trackingLine';
import type { Zone } from '@/core/zones/catalogue';
import { useSavedRoute } from '@/shared-data/routes/useRoutes';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';
import { useZoneHold } from '@/shared-data/zones/zoneInService';
import { navColors } from '@/ui/theme';

import { useGlyphsReady } from '../useGlyphsReady';
import { useLegInfos } from '../useLegInfos';
import { useLegResults } from '../useLegResults';
import { useTrackInfos } from '../useTrackInfos';
import { TrackingSession } from './TrackingSession';

const BLANK = { flex: 1, backgroundColor: navColors.background } as const;

type Ready = {
  route: CreatedRoute | GpxRoute;
  zone: Zone | null;
  installed: Zone[];
};

export function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const routeId = id !== undefined && /^\d+$/.test(id) ? Number(id) : null;
  const router = useRouter();
  const query = useSavedRoute(routeId);
  // A hold: a new zone version does not replace the zone under the tracking.
  const zone = useZoneHold();
  const installed = useInstalledZones().data;
  const glyphsReady = useGlyphsReady();
  const route = query.data;
  // What the tracking starts from is kept as it was read at the start: the
  // Infos screen below may read the route again (a new object, even an
  // error), which must not restart the directions or leave the tracking.
  const [ready, setReady] = useState<Ready | null>(null);
  if (
    !ready &&
    route &&
    route.readable &&
    zone !== undefined &&
    installed &&
    glyphsReady
  ) {
    setReady({
      route,
      zone,
      installed: installed.map((marker) => marker.zone),
    });
  }
  const missing =
    !ready &&
    (routeId === null ||
      route === null ||
      query.isError ||
      (route !== undefined && !route.readable));

  useEffect(() => {
    if (missing) router.back();
  }, [missing, router]);

  if (!ready) return <View style={BLANK} />;
  return (
    <Loaded
      key={ready.route.id}
      route={ready.route}
      zone={ready.zone}
      installed={ready.installed}
    />
  );
}

function Loaded({
  route,
  zone,
  installed,
}: {
  route: CreatedRoute | GpxRoute;
  zone: Zone | null;
  installed: Zone[];
}) {
  // Same reading of the zone as the Infos screen.
  const attach = canAttachZone(route, zone);
  const effective =
    attach && zone
      ? {
          ...route,
          zone: { id: zone.id, version: zone.version, name: zone.name },
        }
      : route;
  const status = routeZoneStatus(effective, zone, installed);
  // The zone is read only when it holds the route (even partly): else the
  // whole line is "Suivez le tracé", on a plain background.
  const mapZone =
    zone && (status === 'usable' || status === 'leaves') ? zone : null;
  const source = useMemo<TrackingSource>(
    () =>
      route.origin === 'gpx'
        ? sourceOfGpx(route.track, mapZone?.bbox ?? null)
        : sourceOfCreated(route.draft, route.legs, mapZone?.bbox ?? null),
    [route, mapZone],
  );
  if (status === 'usable' && mapZone) {
    return route.origin === 'gpx' ? (
      <GpxTracking route={route} zone={mapZone} source={source} />
    ) : (
      <CreatedTracking route={route} zone={mapZone} source={source} />
    );
  }
  return (
    <TrackingSession
      source={source}
      climb={null}
      zone={mapZone}
      name={route.name}
    />
  );
}

function CreatedTracking({
  route,
  zone,
  source,
}: {
  route: CreatedRoute;
  zone: Zone;
  source: TrackingSource;
}) {
  const kept = useMemo(() => reopenDraft(route).kept, [route]);
  const legs = useLegResults(route.draft, zone, kept);
  const { altitudes } = summarizeInfo(
    useLegInfos(route.draft, zone, legs, true),
  );
  const climb = useMemo(
    () =>
      altitudes.status === 'ready' ? climbProfile(altitudes.profile) : null,
    [altitudes],
  );
  return (
    <TrackingSession
      source={source}
      climb={climb}
      zone={zone}
      name={route.name}
    />
  );
}

function GpxTracking({
  route,
  zone,
  source,
}: {
  route: GpxRoute;
  zone: Zone;
  source: TrackingSource;
}) {
  const { altitudes } = summarizeInfo(useTrackInfos(route, zone, true));
  const climb = useMemo(
    () =>
      altitudes.status === 'ready' ? climbProfile(altitudes.profile) : null,
    [altitudes],
  );
  return (
    <TrackingSession
      source={source}
      climb={climb}
      zone={zone}
      name={route.name}
    />
  );
}
