import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Store, useSelector } from '@tanstack/react-store';

import { t } from '@/core/i18n/t';
import {
  plannedEnds,
  sortByDistance,
  trailBounds,
  type Trail,
} from '@/core/trails/trails';
import { updatePhase } from '@/core/trails/updateOffer';
import type { Zone } from '@/core/zones/catalogue';
import type { DownloadEntry } from '@/core/zones/zoneRow';
import { clampToBbox, isInsideBbox } from '@/core/zones/activeZone';
import { nearCenter, nearZoom, openingPlan } from '@/core/zones/opening';
import { Button } from '@/ui/Button';
import { PlusIcon } from '@/ui/icons';
import {
  border,
  colors,
  mapColors,
  radius,
  shadow,
  spacing,
  target,
  text,
} from '@/ui/theme';

import {
  NO_PADDING,
  RECENTER_ZOOM,
  RecenterButton,
  useMapPosition,
  type RecenterState,
} from './MapPosition';
import { FIT_MARGIN, fitView } from './fitView';
import { MIN_ZOOM } from './mapStyle';
import { setDraftTarget } from './draftTarget';
import { TrailEnds } from './TrailEnds';
import { TrailPanel } from './TrailSheet';
import { TrailsLayer } from './TrailsLayer';
import { useTrails } from './useTrails';
import { UserPuckLayers } from './UserPuckLayers';
import { ZoneBaseMap } from './ZoneBaseMap';

const NO_DOWNLOADS = new Store<Record<string, DownloadEntry>>({});

// About the height of the sheet of a circuit: the circuit is framed above it.
const SHEET_COVER = 340;

// "Recentrer" sits 60 from the top. The circuit is framed 16 under it
// (`fitView` adds its own margin to what is covered).
const RECENTER_TOP = 60;
const TOP_COVER = RECENTER_TOP + target.stop + 16 - FIT_MARGIN;

// What the user touched: one circuit (its sheet), or several (the list).
type Selection =
  { kind: 'one'; trail: Trail } | { kind: 'many'; trails: Trail[] };

// First position inside the zone: the map opens on it, at this zoom.
const OPEN_ZOOM = 14;

// Out of the zone, the position is kept this far (points) from the sides, the
// message at the top and "Nouvel itinéraire" at the bottom (mockup 90).
const KEEP_SIDE = 48;
const KEEP_TOP = 140;
const KEEP_BOTTOM = 32;

type EaseOptions = Parameters<CameraRef['easeTo']>[0];

// The map of a ready zone (mockup 90). The glyphs must already be on the disk.
// `downloadStore` and `onUpdateZone` come from the Zones tab (the downloader
// is not ours): they serve the sheet of a circuit of an old zone. Only the
// phase of the download of this zone is read, so the progress of a download
// does not redraw the map.
export function ZoneMap({
  zone,
  downloadStore = NO_DOWNLOADS,
  onUpdateZone,
}: {
  zone: Zone;
  downloadStore?: Store<Record<string, DownloadEntry>>;
  onUpdateZone?: (zone: Zone) => void;
}) {
  const camera = useRef<CameraRef>(null);
  // The map opens on the whole zone, far from the recentering zoom.
  const zoom = useRef(MIN_ZOOM);
  const touched = useRef(false);
  const opened = useRef(false);
  // "La carte suit ma position": the camera of MapLibre follows the position.
  const [following, setFollowing] = useState(false);
  const followingRef = useRef(false);
  const wasFollowing = useRef(false);
  // A circuit is framed (its sheet is open).
  const framed = useRef(false);
  const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The button was touched, or the permission given, before the first position.
  const pendingRecenter = useRef(false);
  const setFollow = (value: boolean) => {
    followingRef.current = value;
    setFollowing(value);
  };
  const { granted, answered, lon, lat, feature, askForPermission } =
    useMapPosition(zone, camera, zoom, () => {
      pendingRecenter.current = true;
      setFollow(true);
    });
  const router = useRouter();
  const trails = useTrails(zone);
  const phase = useSelector(downloadStore, (all) =>
    updatePhase(zone, all[zone.id]),
  );
  const screen = useWindowDimensions();
  const [mapSize, setMapSize] = useState({
    width: screen.width,
    height: screen.height,
  });
  const [bottomHeight, setBottomHeight] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const trailsById = useMemo(
    () => new Map((trails ?? []).map((trail) => [trail.osmId, trail])),
    [trails],
  );
  // Where the user left the map: the creation opens on the same view.
  const view = useRef<{ lon: number; lat: number; zoom: number } | null>(null);
  const chosen = selection?.kind === 'one' ? selection.trail : null;
  // The view before the circuit was framed: the map goes back to it.
  const saved = useRef<{ lon: number; lat: number; zoom: number } | null>(null);
  useEffect(() => {
    if (chosen) {
      if (!framed.current) wasFollowing.current = followingRef.current;
      framed.current = true;
      // The map moves for the circuit: the opening does not move it again.
      touched.current = true;
      saved.current ??= view.current;
      moveCamera(
        {
          ...fitView(trailBounds(chosen), screen, {
            top: TOP_COVER,
            bottom: SHEET_COVER,
          }),
          duration: 300,
        },
        false,
      );
    } else if (framed.current) {
      framed.current = false;
      const follow = wasFollowing.current;
      wasFollowing.current = false;
      const back = saved.current;
      saved.current = null;
      if (back) {
        moveCamera(
          {
            center: [back.lon, back.lat],
            zoom: back.zoom,
            padding: NO_PADDING,
            duration: 300,
          },
          follow,
        );
      } else if (follow) {
        setFollow(true);
      }
    }
    // The screen size is read, not watched: a rotation must not reframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);
  const recenterState: RecenterState = granted
    ? following
      ? 'follow'
      : 'rest'
    : answered
      ? 'refused'
      : 'rest';
  const outside =
    lon !== undefined && lat !== undefined
      ? !isInsideBbox(zone.bbox, lon, lat)
      : false;

  // Our own moves of the camera: the map stops following first, and follows
  // again at the end of the move when `thenFollow` is true.
  function moveCamera(options: EaseOptions, thenFollow: boolean) {
    if (followTimer.current) clearTimeout(followTimer.current);
    followTimer.current = null;
    // Our own move replaces a touch that waited for the first position.
    pendingRecenter.current = false;
    setFollow(false);
    camera.current?.easeTo(options);
    if (thenFollow) {
      followTimer.current = setTimeout(
        () => setFollow(true),
        (options.duration ?? 0) + 50,
      );
    }
  }
  // A gesture of the user: no "follow again" at the end of a move, and no
  // jump to a position that comes later.
  function cancelPending() {
    if (followTimer.current) clearTimeout(followTimer.current);
    followTimer.current = null;
    pendingRecenter.current = false;
  }
  useEffect(
    () => () => {
      if (followTimer.current) clearTimeout(followTimer.current);
    },
    [],
  );

  // Out of the zone, the camera is centered on the closest point of the
  // zone, at the zoom that keeps the position in the free part of the map.
  function frameNear(
    edge: [number, number],
    at: [number, number],
    duration: number,
  ) {
    moveCamera(
      {
        center: nearCenter(zone.bbox, edge),
        zoom: nearZoom(edge, at, mapSize, {
          side: KEEP_SIDE,
          top: KEEP_TOP,
          bottom: bottomHeight + KEEP_BOTTOM,
        }),
        padding: NO_PADDING,
        duration,
      },
      false,
    );
  }

  // The button at rest, with a position (ADR 0021, section 9.4 and 9.5).
  function recenterAt(at: [number, number]) {
    const plan = openingPlan(zone.bbox, at[0], at[1]);
    if (plan.kind === 'inside') {
      if (zoom.current < RECENTER_ZOOM) {
        moveCamera(
          {
            center: at,
            zoom: RECENTER_ZOOM,
            padding: NO_PADDING,
            duration: 500,
          },
          true,
        );
      } else {
        setFollow(true);
      }
    } else if (plan.kind === 'near') {
      frameNear(plan.edge, at, 300);
    } else {
      moveCamera(
        {
          center: clampToBbox(zone.bbox, at[0], at[1]),
          zoom: Math.max(zoom.current, RECENTER_ZOOM),
          padding: NO_PADDING,
          duration: 500,
        },
        false,
      );
    }
  }

  function recenter() {
    if (!granted) {
      askForPermission();
      return;
    }
    if (followingRef.current) return;
    if (lon === undefined || lat === undefined) {
      pendingRecenter.current = true;
      setFollow(true);
      return;
    }
    recenterAt([lon, lat]);
  }

  // At opening: on the first position, if the map has not been touched. In
  // the zone the map goes to it and follows; out of the zone, within 10 km,
  // it frames the closest edge; otherwise the whole zone stays on screen.
  useEffect(() => {
    if (opened.current || lon === undefined || lat === undefined) return;
    opened.current = true;
    if (pendingRecenter.current) {
      pendingRecenter.current = false;
      recenterAt([lon, lat]);
      return;
    }
    if (touched.current) return;
    const plan = openingPlan(zone.bbox, lon, lat);
    if (plan.kind === 'inside') {
      moveCamera(
        {
          center: [lon, lat],
          zoom: OPEN_ZOOM,
          padding: NO_PADDING,
          duration: 300,
        },
        true,
      );
    } else if (plan.kind === 'near') {
      frameNear(plan.edge, [lon, lat], 300);
    }
    // Only the first position matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lon, lat]);

  // The map cannot follow a position out of the zone (the camera is bound
  // to it).
  useEffect(() => {
    if (outside && followingRef.current) setFollow(false);
  }, [outside, following]);

  // A touch on a circuit: one sheet, or the list when several circuits pass
  // under the finger. Not a touch on the map too (`stopPropagation`).
  const onTrailPress = useCallback<
    NonNullable<ComponentProps<typeof TrailsLayer>['onPress']>
  >(
    (e) => {
      e.stopPropagation();
      const found = new Set<Trail>();
      for (const feature of e.nativeEvent.features) {
        const trail = trailsById.get(Number(feature.properties?.osm_id));
        if (trail) found.add(trail);
      }
      if (found.size === 0) return;
      if (found.size === 1) {
        setSelection({ kind: 'one', trail: [...found][0] });
        return;
      }
      setSelection({
        kind: 'many',
        trails: sortByDistance([...found], e.nativeEvent.lngLat),
      });
    },
    [trailsById],
  );

  // "En faire un itinéraire": the creation cuts the circuit once it opens
  // (ADR 0020, section 9). It starts from the last known position.
  function startDraftFromTrail() {
    if (!chosen) return;
    setDraftTarget({
      kind: 'trail',
      osmId: chosen.osmId,
      position: lon !== undefined && lat !== undefined ? { lon, lat } : null,
    });
    setSelection(null);
    router.push('/draft');
  }

  function seeZones() {
    setSelection(null);
    router.navigate('/zones');
  }

  function updateZone(newer: Zone) {
    setSelection(null);
    onUpdateZone?.(newer);
    router.navigate('/zones');
  }

  function openCreation() {
    const at = view.current;
    router.push({
      pathname: '/draft',
      params: at
        ? { lon: String(at.lon), lat: String(at.lat), zoom: String(at.zoom) }
        : {},
    });
  }

  return (
    <View
      style={styles.screen}
      accessibilityLabel={t('map.label', { name: zone.name })}
      onLayout={(e) =>
        setMapSize({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      <ZoneBaseMap
        zone={zone}
        cameraRef={camera}
        onPress={() => setSelection(null)}
        trackUserLocation={following ? 'default' : undefined}
        onTrackUserLocationChange={(e) => {
          // A gesture on the map: MapLibre stops following by itself.
          if (!e.nativeEvent.trackUserLocation) setFollow(false);
        }}
        onRegionWillChange={(e) => {
          if (e.nativeEvent.userInteraction) cancelPending();
        }}
        onRegionDidChange={(e) => {
          const { center, zoom: z, userInteraction } = e.nativeEvent;
          zoom.current = z;
          if (center)
            view.current = { lon: center[0], lat: center[1], zoom: z };
          if (userInteraction) {
            touched.current = true;
            cancelPending();
          }
        }}
      >
        <TrailsLayer trails={trails} onPress={onTrailPress} chosen={chosen} />
        {chosen && (
          <TrailEnds
            ends={plannedEnds(
              chosen,
              lon !== undefined && lat !== undefined ? [lon, lat] : null,
            )}
          />
        )}
        <UserPuckLayers feature={feature} />
      </ZoneBaseMap>

      {selection && (
        <TrailPanel
          many={
            selection.kind === 'many'
              ? {
                  trails: selection.trails,
                  onChoose: (trail) => setSelection({ kind: 'one', trail }),
                  onClose: () => setSelection(null),
                }
              : undefined
          }
          one={
            selection.kind === 'one'
              ? {
                  trail: selection.trail,
                  zone,
                  hasPosition: lon !== undefined && lat !== undefined,
                  phase,
                  onClose: () => setSelection(null),
                  onMake: startDraftFromTrail,
                  onUpdateZone: updateZone,
                  onSeeZones: seeZones,
                }
              : undefined
          }
        />
      )}

      <RecenterButton
        state={recenterState}
        top={RECENTER_TOP}
        onPress={recenter}
      />

      {outside && (
        <View accessibilityRole="alert" style={[styles.notice, { top: 60 }]}>
          <Text style={text.secondary}>{t('map.outsideZone')}</Text>
        </View>
      )}

      <View
        style={styles.bottom}
        pointerEvents="box-none"
        onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.newRoute}>
          <Button
            testID="new-route-button"
            variant="secondary"
            label={t('route.new')}
            accessibilityLabel={t('route.newLabel')}
            icon={(color) => <PlusIcon color={color} />}
            onPress={openCreation}
          />
        </View>
        <View style={styles.attribution} pointerEvents="none">
          <Text style={text.attribution} maxFontSizeMultiplier={1}>
            {t('map.attribution')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  notice: {
    position: 'absolute',
    left: spacing.s4,
    right: 80,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.box,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s3,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  newRoute: {
    alignSelf: 'center',
    marginBottom: spacing.s3,
    borderRadius: radius.button56,
    backgroundColor: colors.creamLight,
    ...shadow,
  },
  attribution: {
    alignSelf: 'flex-start',
    marginLeft: spacing.s2,
    marginBottom: spacing.s2,
    backgroundColor: mapColors.attributionBackground,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
});
