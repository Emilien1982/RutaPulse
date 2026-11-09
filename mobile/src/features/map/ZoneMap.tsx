import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Store, useSelector } from '@tanstack/react-store';

import { t } from '@/core/i18n/t';
import { sortByDistance, trailBounds, type Trail } from '@/core/trails/trails';
import { updatePhase } from '@/core/trails/updateOffer';
import type { Zone } from '@/core/zones/catalogue';
import type { DownloadEntry } from '@/core/zones/zoneRow';
import { isInsideBbox } from '@/core/zones/activeZone';
import { Button } from '@/ui/Button';
import { PlusIcon } from '@/ui/icons';
import {
  border,
  colors,
  mapColors,
  radius,
  shadow,
  spacing,
  text,
} from '@/ui/theme';

import {
  NO_PADDING,
  RECENTER_ZOOM,
  RecenterButton,
  UserPositionLayers,
  useMapPosition,
} from './MapPosition';
import { fitView } from './fitView';
import { TrailPanel } from './TrailSheet';
import { TrailsLayer } from './TrailsLayer';
import { useTrails } from './useTrails';
import { ZoneBaseMap } from './ZoneBaseMap';

const NO_DOWNLOADS = new Store<Record<string, DownloadEntry>>({});

// About the height of the sheet of a circuit: the circuit is framed above it.
const SHEET_COVER = 340;

// What the user touched: one circuit (its sheet), or several (the list).
type Selection =
  { kind: 'one'; trail: Trail } | { kind: 'many'; trails: Trail[] };

// First position inside the zone: the map opens on it, at this zoom.
const OPEN_ZOOM = 14;

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
  const zoom = useRef(RECENTER_ZOOM);
  const touched = useRef(false);
  const opened = useRef(false);
  const { granted, lon, lat, recenter } = useMapPosition(zone, camera, zoom);
  const router = useRouter();
  const trails = useTrails(zone);
  const phase = useSelector(downloadStore, (all) =>
    updatePhase(zone, all[zone.id]),
  );
  const screen = useWindowDimensions();
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
      saved.current ??= view.current;
      camera.current?.easeTo({
        ...fitView(trailBounds(chosen), screen, {
          top: 0,
          bottom: SHEET_COVER,
        }),
        duration: 300,
      });
    } else if (saved.current) {
      const back = saved.current;
      saved.current = null;
      camera.current?.easeTo({
        center: [back.lon, back.lat],
        zoom: back.zoom,
        padding: NO_PADDING,
        duration: 300,
      });
    }
    // The screen size is read, not watched: a rotation must not reframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);
  const outside =
    lon !== undefined && lat !== undefined
      ? !isInsideBbox(zone.bbox, lon, lat)
      : false;

  // At opening: on the first position if it is in the zone and the map has
  // not been touched. Otherwise the whole zone stays on screen.
  useEffect(() => {
    if (opened.current || lon === undefined || lat === undefined) return;
    opened.current = true;
    if (touched.current || !isInsideBbox(zone.bbox, lon, lat)) return;
    camera.current?.easeTo({
      center: [lon, lat],
      zoom: OPEN_ZOOM,
      padding: NO_PADDING,
      duration: 300,
    });
  }, [lon, lat, zone.bbox]);

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

  // T5 completes this: the draft target and the creation. For now the sheet
  // only closes.
  function startDraftFromTrail() {
    setSelection(null);
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
    >
      <ZoneBaseMap
        zone={zone}
        cameraRef={camera}
        onPress={() => setSelection(null)}
        onRegionDidChange={(e) => {
          const { center, zoom: z, userInteraction } = e.nativeEvent;
          zoom.current = z;
          if (center)
            view.current = { lon: center[0], lat: center[1], zoom: z };
          if (userInteraction) touched.current = true;
        }}
      >
        <TrailsLayer trails={trails} onPress={onTrailPress} chosen={chosen} />
        <UserPositionLayers granted={granted} />
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

      <RecenterButton granted={granted} top={60} onPress={recenter} />

      {outside && (
        <View accessibilityRole="alert" style={[styles.notice, { top: 60 }]}>
          <Text style={text.secondary}>{t('map.outsideZone')}</Text>
        </View>
      )}

      <View style={styles.bottom} pointerEvents="box-none">
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
