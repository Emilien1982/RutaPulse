// The Itinéraires tab (mockup 40): the saved routes, the most recent first,
// and their actions (ADR 0019, sections 3, 6, 10 and 13).

import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { announcement } from '@/core/routes/routeName';
import { t } from '@/core/i18n/t';
import type { Zone } from '@/core/zones/catalogue';
import { RoutesTooNewError } from '@/core/routes/migrations';
import { describeRoute, listZoneStatus } from '@/core/routes/routeList';
import { useExportRoute } from '@/shared-data/routes/exportRoute';
import { useRouteActions, useRoutes } from '@/shared-data/routes/useRoutes';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';
import { useZoneInService } from '@/shared-data/zones/zoneInService';
import { ImportFileIcon } from '@/ui/icons';
import { ScreenFrame, TITLE_TOP, type FrameScroll } from '@/ui/ScreenFrame';
import { border, colors, spacing, target, text } from '@/ui/theme';
import { useRouteMenu } from '@/ui/useRouteMenu';

import { RouteItem } from './RouteItem';
import { ReadingIcon } from './ReadingIcon';
import { RoutesEmpty } from './RoutesEmpty';
import { useGpxImport } from './useGpxImport';

export const routesTitle = t('tabs.routes');

export function RoutesScreen({
  onDownloadZone,
}: {
  /** Starts the download of a zone: the downloader is the Zones tab's. */
  onDownloadZone?: (zone: Zone) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useRoutes();
  const installed = useInstalledZones().data;
  const inService = useZoneInService();
  const actions = useRouteActions();
  const exportRoute = useExportRoute(
    inService,
    installed?.map((marker) => marker.zone),
  );
  const gpxImport = useGpxImport(onDownloadZone);
  const menu = useRouteMenu({
    rename: actions.rename,
    remove: actions.remove,
    duplicate: async (id) => {
      const copy = await actions.duplicate(id);
      if (copy) {
        AccessibilityInfo.announceForAccessibility(
          announcement(t('routes.duplicatedAnnounce', { name: copy.name })),
        );
      }
    },
    export: (id) => void exportRoute(id),
  });

  const routes = query.data;

  // A new route (a copy) arrives at the top: bring the list back there, also
  // when the copy was made from the Infos screen (ADR 0020, section 7 bis).
  const scroll = useRef<FrameScroll | null>(null);
  const newestId = routes ? Math.max(0, ...routes.map((r) => r.id)) : null;
  const seenId = useRef<number | null>(null);
  useEffect(() => {
    if (newestId === null) return;
    const grew = seenId.current !== null && newestId > seenId.current;
    seenId.current = newestId;
    if (!grew) return;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) =>
      scroll.current?.scrollTo({ y: 0, animated: !reduced }),
    );
  }, [newestId]);
  const nowYear = new Date().getFullYear();
  const installedIds = installed?.map((marker) => marker.zone.id) ?? [];

  let content = null;
  if (query.isError) {
    const tooNew = query.error instanceof RoutesTooNewError;
    content = (
      <View style={styles.message}>
        <Text
          testID="routes-error-title"
          accessibilityRole="header"
          style={text.titleName}
        >
          {t(tooNew ? 'routes.tooNewTitle' : 'routes.loadFailed')}
        </Text>
        {tooNew && (
          <Text testID="routes-error-text" style={[text.secondary, styles.gap]}>
            {t('routes.tooNewText')}
          </Text>
        )}
      </View>
    );
  } else if (routes && routes.length === 0) {
    content = <RoutesEmpty onCreate={() => router.push('/draft')} />;
  } else if (routes && installed && inService !== undefined) {
    content = routes.map((route) => (
      <RouteItem
        key={route.id}
        route={route}
        line={describeRoute(
          route,
          listZoneStatus(route.zoneId, inService?.id ?? null, installedIds),
          nowYear,
        )}
        onOpen={() => router.push(`/route/${route.id}`)}
        onMenu={() => menu.open(route)}
      />
    ));
  }

  return (
    <View style={styles.screen}>
      <ScreenFrame
        title={t('routes.title')}
        titleTop={Math.max(TITLE_TOP, insets.top + 66)}
        scrollRef={(node) => {
          scroll.current = node;
        }}
      >
        {content}
      </ScreenFrame>
      <Pressable
        testID="routes-import"
        // Android redraws a changed borderStyle badly: another key, a new view.
        key={gpxImport.busy ? 'busy' : 'idle'}
        accessibilityRole="button"
        accessibilityLabel={t('routes.importLabel')}
        accessibilityState={{ disabled: gpxImport.busy }}
        disabled={gpxImport.busy}
        onPress={gpxImport.start}
        style={[
          styles.import,
          gpxImport.busy && styles.importBusy,
          { top: insets.top + 7 },
        ]}
      >
        {gpxImport.busy ? (
          <ReadingIcon color={colors.brown2} />
        ) : (
          <ImportFileIcon color={colors.brown} size={20} />
        )}
        <Text
          style={[styles.importText, gpxImport.busy && styles.importTextBusy]}
        >
          {t(gpxImport.busy ? 'routes.importBusy' : 'routes.import')}
        </Text>
      </Pressable>
      {menu.sheet}
      {gpxImport.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  import: {
    position: 'absolute',
    right: spacing.s4,
    height: target.stop,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: spacing.s3,
    paddingRight: spacing.s4,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: 24,
  },
  // Off, not faded: dashed brown-2 border (mockup 40, 6a).
  importBusy: { borderStyle: 'dashed', borderColor: colors.brown2 },
  importTextBusy: { color: colors.brown2 },
  importText: { fontSize: 16, fontWeight: '600', color: colors.brown },
  message: { paddingVertical: spacing.s6 },
  gap: { marginTop: spacing.s3 },
});
