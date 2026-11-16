import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { useSelector } from '@tanstack/react-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n/t';
import { cameraBearing } from '@/core/tracking/placement';
import { panelOf } from '@/core/tracking/trackingState';
import type { TrackingSource } from '@/core/tracking/trackingLine';
import type { Zone } from '@/core/zones/catalogue';
import { mapColors, navColors, text } from '@/ui/theme';

import { ZoneBaseMap } from '../ZoneBaseMap';
import {
  boundsZoom,
  drawnLine,
  gapDots,
  GESTURE_PAUSE_MS,
  metersPerPoint,
  planCamera,
  REDRAW_M,
  ridePieces,
  riderPoint,
  targetPoint,
  ZOOM_ROAD,
} from './trackingGeometry';
import type { TrackingStore } from './trackingStore';

// Without a zone to draw (deleted, not in service, outside): a plain
// background, the route and the position stay (decision of 10 November).
const PLAIN_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'fond',
      type: 'background',
      paint: { 'background-color': mapColors.background },
    },
  ],
} as const;

const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
const BUTT = { 'line-cap': 'butt', 'line-join': 'round' } as const;
const IS_HAND = ['==', ['get', 'mode'], 'hand'] as never;
const IS_PATH = ['!=', ['get', 'mode'], 'hand'] as never;
const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * The map of the tracking: the route (grey behind the rider, magenta ahead),
 * the dotted gap line, the rider, and a camera driven by our own code, one
 * move a second (ADR 0021, section 3). A gesture on the map pauses the
 * camera for 10 s.
 */
export function TrackingMap({
  zone,
  store,
  source,
  bottom,
}: {
  zone: Zone | null;
  store: TrackingStore['store'];
  source: TrackingSource;
  /** Laid over the map, bottom right (the "Terminer" button). */
  bottom: React.ReactNode;
}) {
  const camera = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const placement = useSelector(store, (s) => s.placement);
  const imminent = useSelector(store, (s) => panelOf(s).imminent);
  const gpsLost = useSelector(store, (s) => s.gpsLost);
  const [northUp, setNorthUp] = useState(false);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const [resume, setResume] = useState(0);
  // A move of the camera before the map has loaded is lost (seen on iOS).
  const [loaded, setLoaded] = useState(false);
  const pausedUntil = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawn = useMemo(() => drawnLine(source.line, source.free), [source]);

  // The ridden part is drawn again when the progress moved by 10 m.
  const [shownM, setShownM] = useState(0);
  if (Math.abs(placement.progressM - shownM) >= REDRAW_M) {
    setShownM(placement.progressM);
  }
  const pieces = useMemo(() => ridePieces(drawn, shownM), [drawn, shownM]);

  const rider = riderPoint(placement);
  const riderData = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: rider ?? [0, 0] },
    }),
    [rider],
  );
  const riderCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: rider ? [riderData] : [],
    }),
    [rider, riderData],
  );
  // The dotted gap line: a dot every 10 points of the screen, at the zoom of
  // the map: the zoom our camera aims at, or the one of a gesture.
  const [zoom, setZoom] = useState(ZOOM_ROAD);
  const dots = useMemo(() => {
    const target = targetPoint(source.line, placement);
    if (!rider || !target) return gapDots([0, 0], [0, 0], 0);
    return gapDots(rider, target, 10 * metersPerPoint(zoom, rider[1]));
  }, [source, placement, rider, zoom]);
  const ends = useMemo(() => {
    const first = source.line.points[0];
    const last = source.line.points[source.line.points.length - 1];
    const feature = (role: string, p: number[]) => ({
      type: 'Feature' as const,
      properties: { role },
      geometry: { type: 'Point' as const, coordinates: p },
    });
    return {
      type: 'FeatureCollection' as const,
      features:
        first && last ? [feature('end', last), feature('start', first)] : [],
    };
  }, [source]);

  // The camera: one move after each position, unless a gesture is recent.
  useEffect(() => {
    if (!loaded || Date.now() < pausedUntil.current || height === 0) return;
    const plan = planCamera(source.line, placement, imminent, northUp);
    // The rider sits in the lower third: the top of the map is padded.
    const padding = {
      top: Math.round(height * 0.33),
      bottom: 0,
      left: 0,
      right: 0,
    };
    const setAimedZoom = (next: number) =>
      setZoom((before) => (Math.abs(before - next) > 0.05 ? next : before));
    if (plan.kind === 'follow') {
      setAimedZoom(plan.zoom);
      camera.current?.easeTo({
        center: plan.center,
        bearing: plan.bearing,
        zoom: plan.zoom,
        padding,
        duration: 1000,
      });
    } else {
      const bearing = plan.kind === 'bounds' ? plan.bearing : 0;
      const fitPadding = { top: 80, bottom: 80, left: 60, right: 60 };
      if (width > 0) {
        setAimedZoom(
          boundsZoom(plan.bounds, bearing, { width, height }, fitPadding),
        );
      }
      camera.current?.fitBounds(plan.bounds, {
        bearing,
        padding: fitPadding,
        duration: 1000,
      });
    }
  }, [source, placement, imminent, northUp, height, width, resume, loaded]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // A gesture of the rider on the map: the camera waits 10 s.
  const touched = (userInteraction: boolean) => {
    if (!userInteraction) return;
    pausedUntil.current = Date.now() + GESTURE_PAUSE_MS;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setResume((n) => n + 1),
      GESTURE_PAUSE_MS + 50,
    );
  };
  const events = {
    onRegionWillChange: (e: { nativeEvent: { userInteraction: boolean } }) =>
      touched(e.nativeEvent.userInteraction),
    onRegionDidChange: (e: {
      nativeEvent: { userInteraction: boolean; zoom?: number };
    }) => {
      touched(e.nativeEvent.userInteraction);
      // The events of our own camera come late (during the move): only the
      // zoom of a gesture is read from them.
      const next = e.nativeEvent.zoom;
      if (next !== undefined && e.nativeEvent.userInteraction) {
        setZoom((before) => (Math.abs(before - next) > 0.05 ? next : before));
      }
    },
  };

  const layers = (
    <>
      <GeoJSONSource id="suivi-fait" data={pieces.done}>
        <Layer
          id="suivi-fait-ligne"
          type="line"
          layout={ROUND}
          paint={{
            'line-color': navColors.done,
            'line-opacity': 0.7,
            'line-width': 8,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="suivi-reste" data={pieces.todo}>
        <Layer
          id="suivi-reste-lisere"
          type="line"
          layout={ROUND}
          paint={{ 'line-color': mapColors.routeCasing, 'line-width': 16 }}
        />
        <Layer
          id="suivi-reste-ligne"
          type="line"
          filter={IS_PATH}
          layout={ROUND}
          paint={{ 'line-color': mapColors.route, 'line-width': 10 }}
        />
        <Layer
          id="suivi-reste-main"
          type="line"
          filter={IS_HAND}
          layout={BUTT}
          paint={{
            'line-color': mapColors.route,
            'line-width': 10,
            'line-dasharray': [2, 1],
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="suivi-ecart" data={dots}>
        <Layer
          id="suivi-ecart-halo"
          type="circle"
          paint={{ 'circle-radius': 4.5, 'circle-color': '#FFFFFF' }}
        />
        <Layer
          id="suivi-ecart-points"
          type="circle"
          paint={{ 'circle-radius': 2.5, 'circle-color': navColors.text }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="suivi-bouts" data={ends}>
        <Layer
          id="suivi-bouts-ronds"
          type="circle"
          paint={{
            'circle-radius': 14,
            'circle-color': [
              'match',
              ['get', 'role'],
              'start',
              mapColors.start,
              mapColors.end,
            ] as never,
            'circle-stroke-width': 3,
            'circle-stroke-color': mapColors.routeCasing,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="suivi-position" data={riderCollection}>
        <Layer
          id="suivi-position-rond"
          type="circle"
          paint={{
            'circle-radius': 14,
            'circle-color': gpsLost
              ? navColors.lostPosition
              : mapColors.position,
            'circle-stroke-width': 3,
            'circle-stroke-color': mapColors.positionBorder,
          }}
        />
      </GeoJSONSource>
    </>
  );

  return (
    <View
      testID="tracking-map"
      style={styles.map}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
        setWidth(e.nativeEvent.layout.width);
      }}
    >
      {zone ? (
        <ZoneBaseMap
          zone={zone}
          cameraRef={camera}
          mapRef={mapRef}
          free
          onDidFinishLoadingMap={() => setLoaded(true)}
          {...events}
        >
          {layers}
        </ZoneBaseMap>
      ) : (
        <Map
          ref={mapRef}
          style={styles.map}
          mapStyle={PLAIN_STYLE as never}
          attribution={false}
          logo={false}
          compass={false}
          touchRotate={false}
          touchPitch={false}
          onDidFinishLoadingMap={() => setLoaded(true)}
          {...events}
        >
          <Camera
            ref={camera}
            initialViewState={{
              center: source.line.points[0] ?? [0, 0],
              zoom: 14,
              padding: NO_PADDING,
            }}
          />
          {layers}
        </Map>
      )}
      <Pressable
        testID="tracking-compass"
        accessibilityRole="button"
        accessibilityLabel={t(
          northUp ? 'tracking.compassNorth' : 'tracking.compassHeading',
        )}
        onPress={() => setNorthUp((value) => !value)}
        style={styles.compass}
      >
        <CompassNeedle
          rotation={northUp ? 0 : -(cameraBearing(placement) ?? 0)}
        />
      </Pressable>
      {/* Short attribution and the "i": the full one would go under "Terminer". */}
      <View style={styles.attribution}>
        <Text style={text.attribution} maxFontSizeMultiplier={1}>
          {t('info.attributionShort')}
        </Text>
        <Pressable
          testID="tracking-attribution-button"
          accessibilityRole="button"
          accessibilityLabel={t('info.attributionButton')}
          hitSlop={16}
          onPress={() => void mapRef.current?.showAttribution()}
          style={styles.attributionButton}
        >
          <Text style={styles.attributionI} maxFontSizeMultiplier={1}>
            i
          </Text>
        </Pressable>
      </View>
      <View style={styles.bottom}>{bottom}</View>
    </View>
  );
}

// The needle of the compass: red to the north, dark to the south.
function CompassNeedle({ rotation }: { rotation: number }) {
  return (
    <Svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      accessible={false}
      style={{ transform: [{ rotate: `${rotation}deg` }] }}
    >
      <Path d="M12 2L17 13H7z" fill={navColors.north} />
      <Path d="M12 22L7 13h10z" fill={navColors.text} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  compass: {
    position: 'absolute',
    right: 16,
    top: 18,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: navColors.background,
    borderWidth: 1,
    borderColor: navColors.floatingBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  attribution: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 5,
    paddingRight: 2,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: mapColors.trackingAttributionBackground,
  },
  attributionButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: navColors.text2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attributionI: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    color: navColors.text2,
  },
  bottom: { position: 'absolute', right: 16, bottom: 16 },
});
