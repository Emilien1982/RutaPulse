// Infos of a saved route, at /route/[id] (ADR 0019, sections 5 and 6). The
// saved track never changes; the infos are calculated again on the zone in
// service when the zone is usable, and the figures of the list are updated.

import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Draft } from '@/core/draft/draft';
import { t } from '@/core/i18n/t';
import { summarizeDifficulty } from '@/core/route-info/difficulty';
import {
  summarizeInfo,
  type AltitudeInfo,
  type Block,
} from '@/core/route-info/routeInfo';
import { RoutesTooNewError } from '@/core/routes/migrations';
import { reopenDraft } from '@/core/routes/reopen';
import type {
  CreatedRoute,
  GpxRoute,
  LonLat,
  SavedRoute,
} from '@/core/routes/savedRoute';
import { formatRouteDate, zoneLine } from '@/core/routes/routeText';
import { trackOfCreated } from '@/core/routes/track';
import { canAttachZone, routeZoneStatus } from '@/core/routes/routeZone';
import type { RouteZoneStatus } from '@/core/routes/routeZone';
import type { Catalogue, Zone } from '@/core/zones/catalogue';
import { zonesCovering } from '@/core/zones/zonesCovering';
import { useExportRoute } from '@/shared-data/routes/exportRoute';
import {
  routeDetailKey,
  useRouteActions,
  useSavedRoute,
} from '@/shared-data/routes/useRoutes';
import { catalogueKey } from '@/shared-data/zones/useCatalogue';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';
import { useZoneHold } from '@/shared-data/zones/zoneInService';
import { Button } from '@/ui/Button';
import { HandModeIcon, MoreIcon } from '@/ui/icons';
import { RoutePreview } from '@/ui/RoutePreview';
import { SignalMark } from '@/ui/SignalMark';
import { border, colors, radius, spacing, text } from '@/ui/theme';
import { useRouteMenu } from '@/ui/useRouteMenu';

import { setDraftTarget } from './draftTarget';
import { mainGeometry, type LineCollection } from './draftGeometry';
import { RouteInfoView, type Figure } from './RouteInfoScreen';
import { ArchFrame, RouteInfoMap } from './RouteInfoMap';
import { useDifficultyTable } from './useDifficultyTable';
import { useLegInfos } from './useLegInfos';
import { sameLegs, useLegResults } from './useLegResults';
import { useTrackInfos } from './useTrackInfos';

const ARCH = { width: 322, height: 140 };

export function SavedRouteInfoScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const routeId = id !== undefined && /^\d+$/.test(id) ? Number(id) : null;
  const query = useSavedRoute(routeId);
  // A hold: a new zone version does not replace the zone under the screen.
  const zone = useZoneHold();
  const installed = useInstalledZones().data;
  const route = query.data;

  if (query.isError) {
    const tooNew = query.error instanceof RoutesTooNewError;
    return (
      <MessageScreen
        title={t(tooNew ? 'routes.tooNewTitle' : 'routes.notFound')}
        message={tooNew ? t('routes.tooNewText') : undefined}
      />
    );
  }
  if (routeId === null || route === null) {
    return <MessageScreen title={t('routes.notFound')} />;
  }
  if (route === undefined || zone === undefined || !installed) {
    return <View style={styles.blank} />;
  }
  if (!route.readable) {
    return (
      <MessageScreen
        title={route.name}
        message={t('route.unreadableText')}
        menuRoute={{ id: route.id, name: route.name }}
      />
    );
  }
  return (
    <LoadedRoute
      route={route}
      zone={zone}
      installed={installed.map((marker) => marker.zone)}
    />
  );
}

// The "⋮" menu of the Infos screens: the same as the list. After a deletion,
// back to the list.
function useInfoMenu(
  route: { id: number; name: string },
  zones?: { inService: Zone | null; installed: Zone[] },
) {
  const router = useRouter();
  const actions = useRouteActions();
  const exportRoute = useExportRoute(zones?.inService, zones?.installed);
  const menu = useRouteMenu({
    rename: actions.rename,
    remove: actions.remove,
    export: (id) => void exportRoute(id),
    onRemoved: () => router.dismissTo('/routes'),
  });
  return {
    sheet: menu.sheet,
    button: {
      accessibilityLabel: t('routes.menuLabel', { name: route.name }),
      onPress: () => menu.open(route),
    },
  };
}

type InfoMenu = ReturnType<typeof useInfoMenu>['button'];

function MessageScreen({
  title,
  message,
  menuRoute,
}: {
  title: string;
  message?: string;
  menuRoute?: { id: number; name: string };
}) {
  const router = useRouter();
  const menu = useInfoMenu(menuRoute ?? { id: 0, name: title });
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.message}>
      {menuRoute && (
        <Pressable
          testID="info-menu"
          accessibilityRole="button"
          accessibilityLabel={menu.button.accessibilityLabel}
          onPress={menu.button.onPress}
          style={[styles.menuButton, { top: insets.top + spacing.s3 }]}
        >
          <MoreIcon color={colors.brown} />
        </Pressable>
      )}
      {menu.sheet}
      <Text
        testID="saved-message-title"
        accessibilityRole="header"
        style={text.titleName}
      >
        {title}
      </Text>
      {message && (
        <Text testID="saved-message" style={[text.secondary, styles.gap]}>
          {message}
        </Text>
      )}
      <View style={styles.gap}>
        <Button
          testID="info-back"
          variant="secondary"
          label={t('routes.back')}
          accessibilityLabel={t('routes.backLabel')}
          onPress={() => router.dismissTo('/routes')}
        />
      </View>
    </View>
  );
}

type Readable = CreatedRoute | GpxRoute;

function LoadedRoute({
  route,
  zone,
  installed,
}: {
  route: Readable;
  zone: Zone | null;
  installed: Zone[];
}) {
  const actions = useRouteActions();
  // A GPX imported outside, whose start is in the zone in service, takes it.
  const attach = canAttachZone(route, zone);
  useEffect(() => {
    if (attach && zone) {
      void actions
        .attachZone(route.id, {
          id: zone.id,
          version: zone.version,
          name: zone.name,
        })
        .catch(() => undefined);
    }
  }, [attach, zone, route.id, actions]);
  const effective: Readable =
    attach && zone
      ? {
          ...route,
          zone: { id: zone.id, version: zone.version, name: zone.name },
        }
      : route;
  const status = routeZoneStatus(effective, zone, installed);
  const { button, sheet } = useInfoMenu(route, { inService: zone, installed });
  let infos: ReactNode;
  if (status === 'usable' && zone) {
    infos =
      effective.origin === 'created' ? (
        <CreatedInfos route={effective} zone={zone} menu={button} />
      ) : (
        <GpxInfos route={effective} zone={zone} menu={button} />
      );
  } else {
    infos = (
      <PlainInfos route={effective} zone={zone} status={status} menu={button} />
    );
  }
  return (
    <>
      {infos}
      {sheet}
    </>
  );
}

// --- Shared pieces ---

function useBack() {
  const router = useRouter();
  return {
    label: t('routes.back'),
    accessibilityLabel: t('routes.backLabel'),
    // Whatever the way in (list, or right after "Enregistrer"): the list.
    // `dismissTo` pops to the (tabs) below and shows the tab; `navigate`
    // would push a second (tabs).
    onPress: () => router.dismissTo('/routes'),
  };
}

/** The figure calculated now, else the saved one, else nothing. */
function figureOf(
  altitudes: Block<AltitudeInfo>,
  key: 'ascentM' | 'descentM',
  stored: number | null,
): Figure {
  if (altitudes.status === 'ready') {
    return { status: 'ready', value: altitudes[key] };
  }
  if (stored !== null) return { status: 'ready', value: stored };
  return { status: altitudes.status };
}

// Writes ascent and descent for the list when they changed (choice 6).
function useSyncFigures(route: Readable, altitudes: Block<AltitudeInfo>) {
  const actions = useRouteActions();
  const queryClient = useQueryClient();
  const written = useRef('');
  const ready = altitudes.status === 'ready';
  const ascent = ready ? Math.round(altitudes.ascentM) : null;
  const descent = ready ? Math.round(altitudes.descentM) : null;
  useEffect(() => {
    if (ascent === null || descent === null) return;
    if (ascent === route.ascentM && descent === route.descentM) return;
    const key = `${route.id}:${ascent}:${descent}`;
    if (written.current === key) return;
    written.current = key;
    // The saved detail is read again, so that a later opening of this screen
    // without a zone shows the figures that the list shows.
    void actions
      .updateFigures(route.id, ascent, descent)
      .then(() =>
        queryClient.invalidateQueries({ queryKey: routeDetailKey(route.id) }),
      )
      .catch(() => undefined);
  }, [
    ascent,
    descent,
    route.id,
    route.ascentM,
    route.descentM,
    actions,
    queryClient,
  ]);
}

function ModifyButton({ routeId }: { routeId: number }) {
  const router = useRouter();
  return (
    <Button
      testID="info-modify"
      variant="secondary"
      label={t('info.modify')}
      accessibilityLabel={t('info.modifyLabel')}
      icon={(color) => <HandModeIcon color={color} />}
      onPress={() => {
        setDraftTarget(routeId);
        router.push('/draft');
      }}
    />
  );
}

// --- A created route on a usable zone ---

function CreatedInfos({
  route,
  zone,
  menu,
}: {
  route: CreatedRoute;
  zone: Zone;
  menu: InfoMenu;
}) {
  const kept = useMemo(() => reopenDraft(route).kept, [route]);
  const rawLegs = useLegResults(route.draft, zone, kept);
  const [legs, setLegs] = useState(rawLegs);
  if (legs !== rawLegs && !sameLegs(legs, rawLegs)) setLegs(rawLegs);
  const legInfos = useLegInfos(route.draft, zone, rawLegs, true);
  const { altitudes, terrain } = summarizeInfo(legInfos);
  const difficulty = summarizeDifficulty(legInfos, useDifficultyTable(zone));
  const geometry = useMemo(
    () => mainGeometry(route.draft, legs, null),
    [route.draft, legs],
  );
  useSyncFigures(route, altitudes);
  return (
    <RouteInfoView
      title={route.name}
      subtitle={zoneLine(route, 'usable')}
      back={useBack()}
      menu={menu}
      map={
        <RouteInfoMap
          zone={zone}
          draft={route.draft}
          lines={geometry.lines}
          links={geometry.links}
        />
      }
      distance={{ status: 'ready', value: route.distanceKm }}
      duration={{ status: 'ready', value: route.durationS }}
      ascent={figureOf(altitudes, 'ascentM', route.ascentM)}
      descent={figureOf(altitudes, 'descentM', route.descentM)}
      altitudes={altitudes}
      terrain={terrain}
      difficulty={difficulty}
      actions={<ModifyButton routeId={route.id} />}
    />
  );
}

// --- A GPX route on a usable zone ---

// The map of a track: two end points and one line.
function trackMapData(track: LonLat[]): {
  draft: Draft;
  lines: LineCollection;
} {
  const first = track[0];
  const last = track[track.length - 1];
  return {
    draft: {
      points: [
        { id: 1, lon: first[0], lat: first[1] },
        { id: 2, lon: last[0], lat: last[1] },
      ],
      modes: ['path'],
    },
    lines: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { mode: 'path' },
          geometry: { type: 'LineString', coordinates: track },
        },
      ],
    },
  };
}

const NO_LINKS: LineCollection = { type: 'FeatureCollection', features: [] };

function GpxInfos({
  route,
  zone,
  menu,
}: {
  route: GpxRoute;
  zone: Zone;
  menu: InfoMenu;
}) {
  const legInfos = useTrackInfos(route, zone, true);
  const { altitudes, terrain } = summarizeInfo(legInfos);
  const difficulty = summarizeDifficulty(legInfos, useDifficultyTable(zone));
  const data = useMemo(() => trackMapData(route.track), [route.track]);
  useSyncFigures(route, altitudes);
  return (
    <RouteInfoView
      title={route.name}
      subtitle={zoneLine(route, 'usable')}
      back={useBack()}
      menu={menu}
      map={
        <RouteInfoMap
          zone={zone}
          draft={data.draft}
          lines={data.lines}
          links={NO_LINKS}
        />
      }
      distance={{ status: 'ready', value: route.distanceKm }}
      duration={{ status: 'ready', value: route.durationS }}
      ascent={figureOf(altitudes, 'ascentM', route.ascentM)}
      descent={figureOf(altitudes, 'descentM', route.descentM)}
      altitudes={altitudes}
      terrain={terrain}
      difficulty={difficulty}
    />
  );
}

// --- No calculation: the zone is deleted, not in service, or does not hold the track ---

function PlainInfos({
  route,
  zone,
  status,
  menu,
}: {
  route: Readable;
  zone: Zone | null;
  status: RouteZoneStatus;
  menu: InfoMenu;
}) {
  const router = useRouter();
  const track = useMemo(
    () =>
      route.origin === 'created'
        ? trackOfCreated(route.draft, route.legs)
        : route.track,
    [route],
  );
  const data = useMemo(() => trackMapData(track), [track]);
  const zoneName = route.zone?.name ?? '';
  // Outside every zone: the zone that holds the track, when the catalogue is
  // already in memory (no request here).
  const client = useQueryClient();
  const catalogue = client.getQueryData<Catalogue>(catalogueKey);
  const start = route.origin === 'gpx' ? route.track[0] : undefined;
  const found =
    status === 'outside' && catalogue && start
      ? zonesCovering(catalogue.zones, start[0], start[1])[0]
      : undefined;
  const notice = noticeOf(status, route.origin, zoneName);
  if (status === 'outside' && catalogue) {
    notice.body += ` ${
      found
        ? t('routes.noticeOutsideFound', { zone: found.name })
        : t('routes.outsideNone')
    }`;
  }
  // The track leaves the zone: the map is there, the infos are not.
  const map =
    status === 'leaves' && zone ? (
      <RouteInfoMap
        zone={zone}
        draft={data.draft}
        lines={data.lines}
        links={NO_LINKS}
      />
    ) : (
      <ArchFrame label={t('routes.arcLabel')}>
        <RoutePreview track={track} {...ARCH} />
      </ArchFrame>
    );
  const none = (stored: number | null): Figure =>
    stored === null
      ? { status: 'missing' }
      : { status: 'ready', value: stored };
  return (
    <RouteInfoView
      title={route.name}
      subtitle={zoneLine(route, status)}
      back={useBack()}
      menu={menu}
      map={map}
      distance={{ status: 'ready', value: route.distanceKm }}
      duration={{ status: 'ready', value: route.durationS }}
      // Outside any zone there is no D+ to speak of: two cells (mockup 6d).
      ascent={status === 'outside' ? undefined : none(route.ascentM)}
      descent={status === 'outside' ? undefined : none(route.descentM)}
      caption={
        route.figuresAt !== null
          ? t('routes.lastFigures', {
              date: formatRouteDate(route.figuresAt, false),
            })
          : undefined
      }
      notice={
        <Notice head={notice.head} body={notice.body}>
          {status !== 'leaves' && (
            <Button
              testID="info-see-zones"
              variant="secondary"
              label={t('routes.seeZones')}
              onPress={() => router.dismissTo('/zones')}
            />
          )}
        </Notice>
      }
      actions={
        route.origin === 'created' && status === 'usable' ? (
          <ModifyButton routeId={route.id} />
        ) : undefined
      }
    />
  );
}

function noticeOf(
  status: RouteZoneStatus,
  origin: SavedRoute['origin'],
  zone: string,
): { head: string; body: string } {
  switch (status) {
    case 'deleted':
      return {
        head: t('routes.noticeDeleted', { zone }),
        body: t(
          origin === 'created'
            ? 'routes.noticeDeletedText'
            : 'routes.noticeDeletedGpxText',
        ),
      };
    case 'notInService':
      return {
        head: t('routes.noticeNotInService', { zone }),
        body: t('routes.noticeNotInServiceText'),
      };
    case 'leaves':
      return {
        head: t('routes.noticeLeaves', { zone }),
        body: t('routes.noticeLeavesText'),
      };
    default:
      return {
        head: t('routes.noticeOutside'),
        body: t('routes.noticeOutsideText'),
      };
  }
}

// "What is missing", in pale mustard with brown text (mockup 40, 7b).
function Notice({
  head,
  body,
  children,
}: {
  head: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View testID="info-notice" accessibilityRole="alert" style={styles.notice}>
      <View style={styles.noticeRow}>
        <SignalMark size={24} testID="info-notice-icon" />
        <Text style={[text.secondary, styles.noticeText, styles.noticeFlex]}>
          <Text style={styles.bold}>{head}</Text>
          {body}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.cream },
  message: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.s4,
    backgroundColor: colors.cream,
  },
  gap: { marginTop: spacing.s3 },
  menuButton: {
    position: 'absolute',
    right: spacing.s3,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    marginTop: spacing.s3,
    gap: spacing.s3,
    padding: spacing.s3,
    backgroundColor: colors.mustardPale,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.box,
  },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { color: colors.brown },
  noticeFlex: { flex: 1 },
  bold: { fontWeight: '700' },
});
