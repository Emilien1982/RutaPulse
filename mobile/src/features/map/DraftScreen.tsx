import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useSelector } from '@tanstack/react-store';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { canLoop, canUndo, type DraftAction } from '@/core/draft/draft';
import { discreteMarkers } from '@/core/draft/markerSpacing';
import { listLegs, summarize } from '@/core/draft/legs';
import { handLengthKm, summarizeInfo } from '@/core/route-info/routeInfo';
import { findProblem } from '@/core/draft/problem';
import { RoutesTooNewError } from '@/core/routes/migrations';
import { announcement, uniqueDefaultName } from '@/core/routes/routeName';
import { getRoute } from '@/core/routes/routeRepo';
import { getRoutesDb } from '@/shared-data/routes/routesDb';
import type { SavedLeg } from '@/core/routes/savedRoute';
import { previewOf, trackOfCreated } from '@/core/routes/track';
import {
  useRouteActions,
  useRoutes,
  useSavedRoute,
} from '@/shared-data/routes/useRoutes';
import { t } from '@/core/i18n/t';
import { HelpCard } from '@/ui/HelpCard';
import { HandModeIcon } from '@/ui/icons';
import { colors, mapColors, spacing, text } from '@/ui/theme';

import { DraftLayers, PreviewLayer } from './DraftLayers';
import {
  DraftMarkers,
  RefusedMarker,
  type MarkerHandlers,
} from './DraftMarkers';
import { DraftTools, ModePicker } from './DraftToolbar';
import { mainGeometry } from './draftGeometry';
import { fitView } from './fitView';
import { routeBounds } from './infoGeometry';
import { useDraftSession } from './DraftSession';
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
import { useLegInfos } from './useLegInfos';
import { sameLegs, useLegResults } from './useLegResults';
import { TrailsLayer } from './TrailsLayer';
import { useTrails } from './useTrails';
import { ZoneBaseMap, type OpeningView } from './ZoneBaseMap';

// A touch on the map waits this long before it adds a point; a touch on an
// annotation empties the queue and blocks the map for the next 300 ms.
const MAP_TOUCH_DELAY_MS = 120;
const ANNOTATION_TOUCH_MS = 300;
const OPEN_LOCK_MS = 1000;
// Height of the bottom panel before it is measured, for the first frame:
// about 285 pt on iOS and 275 dp on Android (captures of T7, phase 7).
const PANEL_GUESS = 280;

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

// Full screen creation of a route (mockup 10). The zone and the Store come
// from the session (ADR 0017, section 7).
export function DraftScreen() {
  const params = useLocalSearchParams<{
    lon?: string;
    lat?: string;
    zoom?: string;
  }>();
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
  return <DraftView opening={opening} />;
}

function DraftView({ opening }: { opening?: OpeningView }) {
  const router = useRouter();
  // A quick double touch opens Infos once, not twice.
  const openedAt = useRef(0);
  function openInfos() {
    if (Date.now() - openedAt.current < OPEN_LOCK_MS) return;
    openedAt.current = Date.now();
    router.push('/draft/infos');
  }
  const camera = useRef<CameraRef>(null);
  const { zone, store, savedStore, kept, trail, gpx, dispatch } =
    useDraftSession();
  const saved = useSelector(savedStore, (s) => s);
  const savedName = useSavedRoute(saved.routeId).data?.name;
  // A route that was already saved when the creation opened ("Modifier") goes
  // back to its Infos screen; a new one opens its Infos on top.
  const [reopened] = useState(() => saved.routeId !== null);
  // A draft placed on the map at once (a route or a circuit): framed whole.
  const placed = kept !== undefined;
  // Default name of a route made from a circuit: its title, until saved.
  const names = useRoutes().data;
  const trailTitle =
    trail && saved.routeId === null
      ? uniqueDefaultName(trail.name, names?.map((r) => r.name) ?? [])
      : undefined;
  const actions = useRouteActions();
  const [saving, setSaving] = useState(false);
  // Set at once, unlike `saving`, which a second press in the same tick
  // does not see yet: two quick presses keep the route only once.
  const saveLock = useRef(false);
  const [exitFor, setExitFor] = useState<number | null>(null);
  const exited = useRef(false);
  const draft = useSelector(store, (s) => s.draft);
  const chosenId = useSelector(store, (s) => s.selected);
  const nextMode = useSelector(store, (s) => s.nextMode);
  const undoable = useSelector(store, canUndo);
  const loopable = useSelector(store, canLoop);

  // The point of the last action, for the error sheet.
  const [target, setTarget] = useState<number | null>(null);
  // The help of the "À la main" mode: from each entry in the mode until the
  // first touch on the map in that mode (mockup 11).
  const [handTouched, setHandTouched] = useState(false);
  // The bubble of the opening of a circuit (mockup 12): 4 s, or 6 s when a
  // part of the trace leaves the zone. Each touch removes one bubble.
  // A GPX opens with its own bubble (6 s), then the one of the part outside.
  const [bubbles, setBubbles] = useState<string[]>(() => {
    if (trail) {
      return [
        t(trail.outside ? 'trails.outsideBubble' : 'trails.placedBubble'),
      ];
    }
    if (gpx) {
      return [
        t('gpx.placedBubble'),
        ...(gpx.outside ? [t('trails.outsideBubble')] : []),
      ];
    }
    return [];
  });
  const bubble = bubbles[0] ?? null;
  const longBubble = trail?.outside === true || gpx !== undefined;
  useEffect(() => {
    if (bubble === null) return;
    const timer = setTimeout(
      () => setBubbles((list) => list.slice(1)),
      longBubble ? 6000 : 4000,
    );
    return () => clearTimeout(timer);
  }, [bubble, longBubble]);
  const trailName = trail?.title;
  const pointCount = draft.points.length;
  useEffect(() => {
    if (trailName === undefined) return;
    AccessibilityInfo.announceForAccessibility(
      t('trails.placedAnnounce', { name: trailName, n: pointCount }),
    );
    // Once, at the opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function act(action: DraftAction) {
    const before = store.state.draft.points;
    dispatch(action);
    setTarget(targetOf(action, before, store.state.draft.points));
  }

  const rawLegs = useLegResults(draft, zone, kept);
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
  // One touch removes one bubble, whatever the order in which the map and the
  // annotation hear it (iOS): nothing is removed if one went less than 300 ms ago.
  const bubbleDroppedAt = useRef(0);
  function dropBubble() {
    if (Date.now() - bubbleDroppedAt.current < ANNOTATION_TOUCH_MS) return;
    bubbleDroppedAt.current = Date.now();
    setBubbles((list) => list.slice(1));
  }
  function touchedAnnotation(dropsBubble = true) {
    // Touching or dragging a point is also a first touch in the hand mode.
    if (nextMode === 'hand') setHandTouched(true);
    if (dropsBubble) dropBubble();
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
  // Zoom at the end of each move: numbered or discrete markers (mockup 12).
  const [shownZoom, setShownZoom] = useState<number | null>(null);
  const [fromTrace] = useState(
    () => kept !== undefined && [...kept.values()].some((leg) => leg.trace),
  );
  const discrete =
    fromTrace &&
    (shownZoom === null || discreteMarkers(draft.points, shownZoom));
  const { granted, recenter } = useMapPosition(zone, camera, zoom);
  const trails = useTrails(zone);
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
  // The ascent comes with them, in one go: when the distance and the
  // altitudes are known, or failed (ADR 0017, section 6).
  const info = summarizeInfo(useLegInfos(draft, zone, rawLegs));
  const altitudes = info.altitudes;
  const ascentM = altitudes.status === 'ready' ? altitudes.ascentM : null;
  const settled = summary.complete && altitudes.status !== 'pending';
  const [shown, setShown] = useState({ ...summary, ascentM });
  if (
    settled &&
    (shown.distanceKm !== summary.distanceKm ||
      shown.durationS !== summary.durationS ||
      shown.ascentM !== ascentM)
  ) {
    setShown({ ...summary, ascentM });
  }
  const computing =
    legs.some((leg) => leg.status === 'pending') ||
    (summary.complete && altitudes.status === 'pending');
  // No figure is known until a first complete summary: dashes until then,
  // and again under 2 points.
  const [hasFigures, setHasFigures] = useState(false);
  if (draft.points.length >= 2 && settled && !hasFigures) {
    setHasFigures(true);
  }
  if (draft.points.length < 2 && hasFigures) setHasFigures(false);

  // Leaving: from 2 points on, a native dialog asks first (also for the back
  // button of Android).
  const [leaving, setLeaving] = useState(false);
  // A saved route asks only when the draft differs from what is saved.
  // A circuit not yet saved starts from a saved draft too (the one it was cut
  // into): closing without a change asks nothing, and the ask is the one of a
  // route not saved (ADR 0020, section 10).
  const isSaved = saved.routeId !== null;
  const hasChanges =
    saved.savedDraft !== null
      ? draft !== saved.savedDraft
      : draft.points.length >= 2;
  usePreventRemove(hasChanges && !leaving, ({ repeat }) => {
    Alert.alert(
      t(isSaved ? 'route.abandonChangesTitle' : 'route.abandonTitle'),
      t(isSaved ? 'route.abandonChangesText' : 'route.abandonText'),
      [
        { text: t('route.abandonKeep'), style: 'cancel' },
        {
          text: t('route.abandonConfirm'),
          style: 'destructive',
          onPress: () => {
            setLeaving(true);
            repeat();
          },
        },
      ],
    );
  });

  // "Enregistrer": keeps the route at once (new: default name; reopened:
  // the same row is replaced), then the creation closes and the saved route
  // opens (mockup 40, 8a).
  const canSave =
    hasFigures &&
    !computing &&
    !problem &&
    !saving &&
    (!isSaved || draft !== saved.savedDraft);
  // After "Enregistrer": the creation closes, then the saved route opens
  // (mockup 40, 8a). A route that came from its Infos screen goes back to it,
  // which reads it again; a new one is opened on top of the screen below.
  useEffect(() => {
    if (exitFor === null || hasChanges || exited.current) return;
    exited.current = true;
    router.back();
    // A route opened by "Modifier" goes back to its Infos screen below.
    if (!reopened) router.push(`/route/${exitFor}`);
  }, [exitFor, hasChanges, reopened, router]);
  async function save() {
    if (!canSave) return;
    const legs: SavedLeg[] = [];
    for (const leg of rawLegs) {
      if (leg.status === 'hand') legs.push({ mode: 'hand' });
      else if (leg.status === 'done') {
        legs.push({
          mode: 'path',
          zoneVersion: leg.shapeVersion ?? zone.version,
          distanceKm: leg.result.distanceKm,
          durationS: leg.result.durationS,
          shape: leg.result.shape,
          ...(leg.trace ? { trace: true as const } : {}),
        });
      } else return;
    }
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const now = Date.now();
      const input = {
        draft,
        legs,
        zone: { id: zone.id, version: zone.version, name: zone.name },
        preview: previewOf(trackOfCreated(draft, legs)),
        distanceKm: summary.distanceKm,
        durationS: summary.durationS,
        ascentM: altitudes.status === 'ready' ? altitudes.ascentM : null,
        descentM: altitudes.status === 'ready' ? altitudes.descentM : null,
        figuresAt: altitudes.status === 'ready' ? now : null,
      };
      let id = saved.routeId;
      if (id === null) {
        id = trail
          ? await actions.create({
              origin: 'trail',
              baseName: trail.name,
              ...input,
              now,
            })
          : await actions.create({ origin: 'created', ...input, now });
      } else {
        const full = { ...input, savedAt: now };
        // A GPX becomes "editedGpx" once; a second press replaces that row.
        if (!gpx || !(await actions.replaceGpx(id, full))) {
          await actions.replace(id, full);
        }
      }
      savedStore.setState(() => ({ routeId: id, savedDraft: draft }));
      const row = await getRoute(await getRoutesDb(), id);
      if (row) {
        AccessibilityInfo.announceForAccessibility(
          announcement(t('route.savedAnnounce', { name: row.name })),
        );
      }
      // The creation closes once the screen knows nothing is left to save.
      setExitFor(id);
    } catch (error) {
      Alert.alert(
        t(
          error instanceof RoutesTooNewError
            ? 'routes.tooNewTitle'
            : 'route.saveFailedTitle',
        ),
        t(
          error instanceof RoutesTooNewError
            ? 'routes.tooNewText'
            : 'route.saveFailedText',
        ),
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  // The drawn legs do not change during a gesture but for the two next to
  // the dragged point, and only when the legs or the draft change.
  const geometry = useMemo(
    () => mainGeometry(draft, legs, draggedId),
    [draft, legs, draggedId],
  );

  // A reopened route ("Modifier") opens on its track: the box of the route,
  // 48 of margin, under the top bar and above the bottom panel, once, as soon
  // as the panel is measured and the map has loaded. Before that the native
  // camera does not exist yet (the Map mounts its children after its first
  // layout), so `camera.current` is null and an easeTo would be lost.
  const screenSize = useWindowDimensions();
  const [bottomHeight, setBottomHeight] = useState(0);
  // A placed draft opens already framed on its track (a first guess of the
  // panel height; the exact fit below follows without animation), instead of
  // the whole zone.
  const [placedView] = useState<OpeningView | undefined>(() => {
    if (!placed || opening) return undefined;
    const bounds = routeBounds(draft, geometry.lines);
    if (!bounds) return undefined;
    return fitView(bounds, screenSize, {
      top: barHeight,
      bottom: PANEL_GUESS,
    });
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const fitted = useRef(false);
  useEffect(() => {
    if (
      fitted.current ||
      !placed ||
      opening ||
      bottomHeight === 0 ||
      !mapLoaded
    )
      return;
    const bounds = routeBounds(draft, geometry.lines);
    if (!bounds || !camera.current) return;
    fitted.current = true;
    const fit = fitView(bounds, screenSize, {
      top: barHeight,
      bottom: bottomHeight,
    });
    camera.current.easeTo({ ...fit, duration: 0 });
  }, [
    placed,
    opening,
    bottomHeight,
    mapLoaded,
    barHeight,
    draft,
    geometry,
    screenSize,
  ]);

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
        // The choice of another point goes away now. Only the key of that
        // other point changes, not the key of the dragged one: the gesture
        // goes on.
        const current = store.state.selected;
        if (current !== null && current !== id) {
          dispatch({ type: 'select', id: null });
        }
        dragging.current = id;
        // Empties the preview of a previous gesture.
        clearPreview();
        setGesturing(true);
        setDraggedId(id);
      },
      onDrag: (id, p) => drag(id, p.lon, p.lat),
      onDragEnd: (id, p) => {
        touchedAnnotation(false);
        dragging.current = null;
        // The move first: the preview must not be judged on the old legs.
        release(id, p.lon, p.lat);
        setGesturing(false);
        // The dragged point becomes the chosen one. Its key changes only now,
        // after the gesture.
        dispatch({ type: 'select', id });
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
    : bubble !== null
      ? { id: 'trail-bubble', label: bubble }
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
                  draft.points.length === 0
                    ? 'route.hintStart'
                    : 'route.hintEnd',
                ),
              }
            : undefined;

  const showHandHelp = !problem && nextMode === 'hand' && !handTouched;

  return (
    <View style={styles.screen}>
      <ZoneBaseMap
        zone={zone}
        cameraRef={camera}
        opening={opening ?? placedView}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
        onRegionDidChange={(e) => {
          zoom.current = e.nativeEvent.zoom;
          if (fromTrace) setShownZoom(e.nativeEvent.zoom);
        }}
        onPress={(e) => {
          dropBubble();
          if (problem) return;
          if (nextMode === 'hand') setHandTouched(true);
          const [lon, lat] = e.nativeEvent.lngLat;
          touchMap(lon, lat);
        }}
      >
        <TrailsLayer trails={trails} />
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
          discrete={discrete}
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
      <RouteTopBar
        onClose={() => router.back()}
        onHeight={setBarHeight}
        title={savedName ?? trailTitle}
        onSave={{ enabled: canSave, press: () => void save() }}
        saveLabel={
          savedName
            ? t('route.saveChangesLabel', { name: savedName })
            : t('route.saveLabel')
        }
        saveOffLabel={
          draft.points.length < 2
            ? t('route.saveOffLabel')
            : isSaved && draft === saved.savedDraft
              ? t('route.saveNoChangeLabel')
              : t('route.save')
        }
      />
      {showHandHelp && (
        <HelpCard
          top={barHeight + spacing.s3}
          testID="route-hand-help"
          icon={<HandModeIcon size={16} color={colors.brown} />}
          lead={t('route.handHelpLead')}
          text={t('route.handHelpText')}
        />
      )}
      {hint && !showHandHelp && (
        <RouteBubble
          top={barHeight + spacing.s3}
          testID={hint.id}
          label={hint.label}
        />
      )}

      <View
        testID="draft-bottom"
        style={styles.bottom}
        pointerEvents="box-none"
        onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.attribution} pointerEvents="none">
          <Text style={text.attribution} maxFontSizeMultiplier={1}>
            {t('map.attribution')}
          </Text>
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
            ascentM={shown.ascentM}
            pending={computing}
            empty={!hasFigures}
            onOpen={hasFigures && !computing ? openInfos : undefined}
          >
            <ModePicker
              mode={nextMode}
              handKm={handLengthKm(listLegs(draft))}
              onChoose={(mode) => {
                if (mode === 'hand' && nextMode !== 'hand') {
                  setHandTouched(false);
                }
                dispatch({ type: 'chooseMode', mode });
              }}
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
