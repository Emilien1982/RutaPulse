import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useSelector } from '@tanstack/react-store';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { canLoop, canUndo, type DraftAction } from '@/core/draft/draft';
import { summarize } from '@/core/draft/legs';
import { findProblem } from '@/core/draft/problem';
import { t } from '@/core/i18n/t';
import { pickActiveZone } from '@/core/zones/activeZone';
import type { Zone } from '@/core/zones/catalogue';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';
import { colors, mapColors, spacing, text } from '@/ui/theme';

import { DraftLayers, PreviewLayer } from './DraftLayers';
import {
  DraftMarkers,
  RefusedMarker,
  type MarkerHandlers,
} from './DraftMarkers';
import { DraftTools, ModePicker } from './DraftToolbar';
import { mainGeometry } from './draftGeometry';
import { createDraftStore } from './draftStore';
import {
  RouteBubble,
  RouteErrorSheet,
  RouteSummarySheet,
  RouteTopBar,
} from './RouteSheets';
import {
  RecenterButton,
  UserPositionLayers,
  useMapPosition,
} from './MapPosition';
import { useDragPreviewStore } from './useDragPreview';
import { useGlyphsReady } from './useGlyphsReady';
import { useLegResults, type LegState } from './useLegResults';
import { ZoneBaseMap, type OpeningView } from './ZoneBaseMap';

// A touch on the map waits this long before it adds a point; a touch on an
// annotation empties the queue and blocks the map for the next 300 ms.
const MAP_TOUCH_DELAY_MS = 120;
const ANNOTATION_TOUCH_MS = 300;

// The point of the last action: the one the error sheet is about (ADR 0016,
// section 5). `before` is the draft before the action, `after` the one after.
function targetOf(
  action: DraftAction,
  before: { id: number }[],
  after: { id: number }[],
): number | null {
  switch (action.type) {
    case 'add':
    case 'loop':
      return after[after.length - 1]?.id ?? null;
    case 'move':
      return action.id;
    case 'remove': {
      // The arrival of the leg that replaced the removed point.
      const index = before.findIndex((p) => p.id === action.id);
      return after[index]?.id ?? null;
    }
    default:
      return null;
  }
}

// True when the two lists draw the same thing: the screen then keeps the old
// list, and what depends on it is not computed again.
function sameLegs(a: LegState[], b: LegState[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      if (!y || x.status !== y.status) return false;
      if (x.status === 'done' && y.status === 'done') {
        return x.result === y.result;
      }
      if (x.status === 'hand' && y.status === 'hand') {
        return (
          x.result.distanceKm === y.result.distanceKm &&
          x.result.durationS === y.result.durationS
        );
      }
      if (x.status === 'error' && y.status === 'error') {
        return x.error === y.error;
      }
      return true;
    })
  );
}

// Full screen creation of a route (mockup 10). Waits for the disk like the
// map tab does: the zone, then the glyphs.
export function DraftScreen() {
  const installed = useInstalledZones();
  const glyphsReady = useGlyphsReady();
  const params = useLocalSearchParams<{
    lon?: string;
    lat?: string;
    zoom?: string;
  }>();
  const zone = installed.data ? pickActiveZone(installed.data) : null;
  if (!zone || !glyphsReady) return <View style={styles.blank} />;
  const lon = Number(params.lon);
  const lat = Number(params.lat);
  const zoom = Number(params.zoom);
  const opening: OpeningView | undefined =
    params.lon &&
    params.lat &&
    params.zoom &&
    [lon, lat, zoom].every(Number.isFinite)
      ? { center: [lon, lat], zoom }
      : undefined;
  return (
    <DraftView
      key={`${zone.id}-${zone.version}`}
      zone={zone}
      opening={opening}
    />
  );
}

function DraftView({ zone, opening }: { zone: Zone; opening?: OpeningView }) {
  const router = useRouter();
  const camera = useRef<CameraRef>(null);
  // The store lives as long as the screen.
  const [{ store, dispatch }] = useState(createDraftStore);
  const draft = useSelector(store, (s) => s.draft);
  const chosenId = useSelector(store, (s) => s.selected);
  const nextMode = useSelector(store, (s) => s.nextMode);
  const undoable = useSelector(store, canUndo);
  const loopable = useSelector(store, canLoop);

  // The point of the last action, for the error sheet.
  const [target, setTarget] = useState<number | null>(null);
  function act(action: DraftAction) {
    const before = store.state.draft.points;
    dispatch(action);
    setTarget(targetOf(action, before, store.state.draft.points));
  }

  const rawLegs = useLegResults(draft, zone);
  const [legs, setLegs] = useState(rawLegs);
  if (legs !== rawLegs && !sameLegs(legs, rawLegs)) setLegs(rawLegs);

  // Touching an annotation can also reach the map as a touch (seen on iOS).
  // A touch on the map therefore waits a moment: if an annotation is touched
  // meanwhile (or was just before), no point is added. Touches that come
  // within the delay of each other each wait in the queue, and each add their
  // point. A touch on the map is ignored while a point is being dragged.
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>());
  const annotationAt = useRef(0);
  const problemOpen = useRef(false);
  // Id of the point being dragged (null: no gesture).
  const dragging = useRef<number | null>(null);
  function touchedAnnotation() {
    annotationAt.current = Date.now();
    pending.current.forEach(clearTimeout);
    pending.current.clear();
  }
  function touchMap(lon: number, lat: number) {
    if (dragging.current !== null) return;
    if (Date.now() - annotationAt.current < ANNOTATION_TOUCH_MS) return;
    const timer = setTimeout(() => {
      pending.current.delete(timer);
      // Checked again now: an error sheet may have opened meanwhile.
      if (problemOpen.current || dragging.current !== null) return;
      act({ type: 'add', lon, lat });
    }, MAP_TOUCH_DELAY_MS);
    pending.current.add(timer);
  }
  useEffect(() => {
    const queue = pending.current;
    return () => {
      queue.forEach(clearTimeout);
      queue.clear();
    };
  }, []);

  // Heights measured by the bar and the error sheet.
  const [barHeight, setBarHeight] = useState(112);
  // Position of the user: the blue dot and the button "Ma position".
  const zoom = useRef(opening?.zoom ?? 15);
  const { granted, recenter } = useMapPosition(zone, camera, zoom);
  const [sheetHeight, setSheetHeight] = useState(0);

  // Dragging: the point being dragged, until its two legs are computed again.
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const { previewStore, drag, release, cancel, clearPreview } =
    useDragPreviewStore(
      () => store.state.draft,
      (id, lon, lat) => act({ type: 'move', id, lon, lat }),
    );

  // The preview goes away when the gesture is over and the two legs next to
  // the point are not waiting any more (computed, or failed, or nothing
  // changed): it never hides the final result nor an error.
  if (draggedId !== null && !gesturing) {
    const index = draft.points.findIndex((p) => p.id === draggedId);
    // `rawLegs`, not `legs`: the kept list can be one render late.
    const waiting = [index - 1, index].some(
      (i) => rawLegs[i]?.status === 'pending',
    );
    // The preview store is not touched while rendering: with no dragged
    // point `previewGeometry` is empty, and the next gesture empties the store.
    if (!waiting) {
      setDraggedId(null);
    }
  }

  // The gesture falls back cleanly when its point is gone (refused, or drawn
  // again under a new key): nothing is moved, the preview goes away.
  function dragLost(id: number) {
    if (dragging.current !== id) return;
    dragging.current = null;
    cancel();
    setGesturing(false);
    clearPreview();
    setDraggedId(null);
  }

  const errors = legs.map((leg) =>
    leg.status === 'error' ? leg.error : undefined,
  );
  const problem = findProblem(draft, errors, target, zone.bbox);
  useEffect(() => {
    problemOpen.current = !!problem;
  });
  const refused = problem && draft.points.find((p) => p.id === problem.pointId);

  // The refused point goes to the center of the visible part: under the top
  // bar and above the error sheet (padding = what is covered).
  const refusedLon = refused?.lon;
  const refusedLat = refused?.lat;
  useEffect(() => {
    if (refusedLon === undefined || refusedLat === undefined) return;
    camera.current?.easeTo({
      center: [refusedLon, refusedLat],
      padding: { top: barHeight, bottom: sheetHeight, left: 0, right: 0 },
      duration: 300,
    });
  }, [refusedLon, refusedLat, barHeight, sheetHeight]);

  // Distance and duration: the sum of the legs. During a calculation the
  // previous figures stay (faded).
  const summary = summarize(
    draft,
    legs.map((leg) => (leg.status === 'done' ? leg.result : undefined)),
  );
  const [shown, setShown] = useState(summary);
  if (
    summary.complete &&
    (shown.distanceKm !== summary.distanceKm ||
      shown.durationS !== summary.durationS)
  ) {
    setShown(summary);
  }
  const computing = legs.some((leg) => leg.status === 'pending');

  // Leaving: from 2 points on, a native dialog asks first (also for the back
  // button of Android).
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(draft.points.length >= 2 && !leaving, ({ repeat }) => {
    Alert.alert(t('route.abandonTitle'), t('route.abandonText'), [
      { text: t('route.abandonKeep'), style: 'cancel' },
      {
        text: t('route.abandonConfirm'),
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          repeat();
        },
      },
    ]);
  });

  // The drawn legs do not change during a gesture but for the two next to
  // the dragged point, and only when the legs or the draft change.
  const geometry = useMemo(
    () => mainGeometry(draft, legs, draggedId),
    [draft, legs, draggedId],
  );

  // Stable handlers for the annotations: they read the latest screen state
  // through a ref, so that the annotations are not drawn again for nothing.
  const latest = useRef<MarkerHandlers | null>(null);
  useEffect(() => {
    latest.current = {
      onChoose: (id) => {
        touchedAnnotation();
        dispatch({ type: 'select', id: id === chosenId ? null : id });
      },
      onDragStart: (id) => {
        touchedAnnotation();
        dragging.current = id;
        // Empties the preview of a previous gesture.
        clearPreview();
        setGesturing(true);
        setDraggedId(id);
      },
      onDrag: (id, p) => drag(id, p.lon, p.lat),
      onDragEnd: (id, p) => {
        touchedAnnotation();
        dragging.current = null;
        // The move first: the preview must not be judged on the old legs.
        release(id, p.lon, p.lat);
        setGesturing(false);
      },
      onGone: dragLost,
    };
  });
  const [handlers] = useState<MarkerHandlers>(() => ({
    onChoose: (id) => latest.current?.onChoose(id),
    onDragStart: (id) => latest.current?.onDragStart(id),
    onDrag: (id, p) => latest.current?.onDrag(id, p),
    onDragEnd: (id, p) => latest.current?.onDragEnd(id, p),
    onGone: (id) => latest.current?.onGone(id),
  }));
  // The bubble of the gesture (mockup 10): it changes twice per gesture, at
  // its start and at its end, never per move event.
  const dragNumber =
    gesturing && draggedId !== null
      ? draft.points.findIndex((p) => p.id === draggedId) + 1
      : 0;
  const hint = problem
    ? undefined
    : dragNumber > 0
      ? {
          id: 'route-bubble-drag',
          label: t('route.dragBubble', { n: dragNumber }),
        }
      : chosenId !== null
        ? { id: 'route-hint-drag', label: t('route.hintDrag') }
        : draft.points.length < 2
          ? {
              id: 'route-hint',
              label: t(
                draft.points.length === 0 ? 'route.hintStart' : 'route.hintEnd',
              ),
            }
          : undefined;

  return (
    <View style={styles.screen}>
      <ZoneBaseMap
        zone={zone}
        cameraRef={camera}
        opening={opening}
        onRegionDidChange={(e) => {
          zoom.current = e.nativeEvent.zoom;
        }}
        onPress={(e) => {
          if (problem) return;
          const [lon, lat] = e.nativeEvent.lngLat;
          touchMap(lon, lat);
        }}
      >
        <DraftLayers lines={geometry.lines} links={geometry.links} />
        <PreviewLayer
          store={previewStore}
          draft={draft}
          legs={legs}
          draggedId={draggedId}
        />
        <UserPositionLayers granted={granted} />
        <DraftMarkers
          points={draft.points}
          chosenId={chosenId}
          refusedId={problem?.pointId ?? null}
          handlers={handlers}
        />
        {refused && (
          <RefusedMarker
            point={refused}
            outsideBbox={problem?.kind === 'outOfZone' ? zone.bbox : undefined}
          />
        )}
      </ZoneBaseMap>

      <RecenterButton
        granted={granted}
        top={barHeight + 64}
        onPress={recenter}
      />
      <RouteTopBar onClose={() => router.back()} onHeight={setBarHeight} />
      {hint && (
        <RouteBubble
          top={barHeight + spacing.s3}
          testID={hint.id}
          label={hint.label}
        />
      )}

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.attribution} pointerEvents="none">
          <Text style={text.attribution}>{t('map.attribution')}</Text>
        </View>
        {problem ? (
          <RouteErrorSheet
            kind={problem.kind}
            onRemove={() => act({ type: 'remove', id: problem.pointId })}
            onRelink={
              problem.legIndices.length > 0
                ? () =>
                    act({
                      type: 'setLegMode',
                      indices: problem.legIndices,
                      mode: 'hand',
                      linkedPointId: problem.pointId,
                    })
                : undefined
            }
            onHeight={setSheetHeight}
          />
        ) : (
          <RouteSummarySheet
            distanceKm={shown.distanceKm}
            durationS={shown.durationS}
            pending={computing}
          >
            <ModePicker
              mode={nextMode}
              onChoose={(mode) => dispatch({ type: 'chooseMode', mode })}
            />
            <DraftTools
              canUndo={undoable}
              canLoop={loopable}
              canDelete={chosenId !== null}
              onUndo={() => act({ type: 'undo' })}
              onLoop={() => act({ type: 'loop' })}
              onDelete={() =>
                chosenId !== null && act({ type: 'remove', id: chosenId })
              }
            />
          </RouteSummarySheet>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.cream },
  screen: { flex: 1, backgroundColor: colors.cream },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  attribution: {
    alignSelf: 'flex-start',
    marginLeft: spacing.s2,
    marginBottom: spacing.s2,
    backgroundColor: mapColors.attributionBackground,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
});
