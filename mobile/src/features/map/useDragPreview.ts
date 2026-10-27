// Preview of the two legs next to a dragged point (ADR 0016, section 4).
// The calculations go straight to the engine, beside the Query cache.

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

export function useDragPreview(
  getDraft: () => Draft,
  onMove: (id: number, lon: number, lat: number) => void,
) {
  const [preview, setPreview] = useState<DragPreview>({});
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
        if (leg.mode !== 'path') continue;
        if (leg.from.id !== moving.id && leg.to.id !== moving.id) continue;
        const from = at(leg.index);
        const to = at(leg.index + 1);
        if (!from || !to) continue;
        void computeRoute([from, to], own.signal)
          .catch(() => undefined)
          .then((result) => {
            // A failure, or an answer to an old calculation: keep the old line.
            if (number !== last.current || !result?.ok) return;
            setPreview((old) => ({ ...old, [leg.index]: result }));
          });
      }
    },
    [abortCurrent],
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
    [throttler],
  );

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

  const clearPreview = useCallback(() => setPreview({}), []);

  return { preview, drag, release, clearPreview };
}
