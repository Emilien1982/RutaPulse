// Preview of the two legs next to a dragged point (ADR 0016, section 4).
// The calculations go straight to the engine, beside the Query cache.

import { createStore, useSelector } from '@tanstack/react-store';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Draft } from '@/core/draft/draft';
import { listLegs } from '@/core/draft/legs';
import type { RoutePoint } from '@/core/routing/routeRequest';
import type { RouteSuccess } from '@/core/routing/routeResponse';
import { computeRoute } from '@/shared-data/routing/computeRoute';

import { useDragThrottle } from './useDragThrottle';

/** Last good preview of each leg, by leg index. */
export type DragPreview = Record<number, RouteSuccess>;

type Moving = { id: number } & RoutePoint;

/**
 * Same as `useDragPreview`, but the preview lives in a store that the caller
 * does not read: only the component that subscribes to `previewStore` draws
 * again when an answer comes (ADR 0016, section 4: nothing else changes
 * during the gesture).
 */
export function useDragPreviewStore(
  getDraft: () => Draft,
  onMove: (id: number, lon: number, lat: number) => void,
) {
  const [previewStore] = useState(() => createStore<DragPreview>({}));
  const setPreview = useCallback(
    (next: DragPreview | ((old: DragPreview) => DragPreview)) =>
      previewStore.setState(typeof next === 'function' ? next : () => next),
    [previewStore],
  );
  // Number of the last calculation, and its controller.
  const last = useRef(0);
  const controller = useRef<AbortController | null>(null);
  // Keeps the callbacks fresh without recreating the throttled function.
  const getDraftRef = useRef(getDraft);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    getDraftRef.current = getDraft;
    onMoveRef.current = onMove;
  });

  // True between the first move event of a gesture and its release.
  const dragging = useRef(false);
  const abortCurrent = useCallback(() => {
    last.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);

  const compute = useCallback(
    (moving: Moving) => {
      abortCurrent();
      const number = last.current;
      const own = new AbortController();
      controller.current = own;
      const draft = getDraftRef.current();
      const at = (index: number) => {
        const p = draft.points[index];
        return p && p.id === moving.id ? moving : p;
      };
      for (const leg of listLegs(draft)) {
        if (leg.from.id !== moving.id && leg.to.id !== moving.id) continue;
        const from = at(leg.index);
        const to = at(leg.index + 1);
        if (!from || !to) continue;
        if (leg.mode === 'hand') {
          // A "by hand" leg follows the point as a straight line.
          setPreview((old) => ({
            ...old,
            [leg.index]: {
              ok: true,
              shape: [
                [from.lon, from.lat],
                [to.lon, to.lat],
              ],
              distanceKm: 0,
              durationS: 0,
            },
          }));
          continue;
        }
        void computeRoute([from, to], own.signal)
          .catch(() => undefined)
          .then((result) => {
            // A failure, or an answer to an old calculation: keep the old line.
            if (number !== last.current || !result?.ok) return;
            setPreview((old) => ({ ...old, [leg.index]: result }));
          });
      }
    },
    [abortCurrent, setPreview],
  );

  const throttler = useDragThrottle(compute);

  // Stop the running calculation when the screen goes away.
  useEffect(() => abortCurrent, [abortCurrent]);

  /** Called for each move event of the gesture. */
  const drag = useCallback(
    (id: number, lon: number, lat: number) => {
      if (!dragging.current) {
        dragging.current = true;
        setPreview({});
      }
      throttler.maybeExecute({ id, lon, lat });
    },
    [throttler, setPreview],
  );

  /** The gesture is lost (its point is gone): nothing is moved. */
  const cancel = useCallback(() => {
    dragging.current = false;
    throttler.cancel();
    abortCurrent();
  }, [throttler, abortCurrent]);

  /** Called by the end event, with its own position. */
  const release = useCallback(
    (id: number, lon: number, lat: number) => {
      dragging.current = false;
      throttler.cancel();
      abortCurrent();
      onMoveRef.current(id, lon, lat);
    },
    [throttler, abortCurrent],
  );

  const clearPreview = useCallback(() => setPreview({}), [setPreview]);

  return { previewStore, drag, release, cancel, clearPreview };
}

export function useDragPreview(
  getDraft: () => Draft,
  onMove: (id: number, lon: number, lat: number) => void,
) {
  const { previewStore, ...rest } = useDragPreviewStore(getDraft, onMove);
  const preview = useSelector(previewStore, (s) => s);
  return { preview, ...rest };
}
