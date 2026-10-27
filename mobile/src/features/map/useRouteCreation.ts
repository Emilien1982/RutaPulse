import { useCallback, useRef, useState } from 'react';

import type { RoutePoint } from '@/core/routing/routeRequest';
import type {
  RouteErrorKind,
  RouteResult,
  RouteSuccess,
} from '@/core/routing/routeResponse';
import { isInsideBbox } from '@/core/zones/activeZone';
import type { Bbox } from '@/core/zones/catalogue';
import { computeRoute } from '@/shared-data/routing/computeRoute';

export type RouteProblem = {
  kind: RouteErrorKind;
  /** The point to mark on the map. */
  point: RoutePoint;
  /** True when the point is the end of the route (the engine refused it). */
  isEnd: boolean;
};

export type RouteCreation = {
  creating: boolean;
  start?: RoutePoint;
  end?: RoutePoint;
  computing: boolean;
  route?: RouteSuccess;
  problem?: RouteProblem;
};

const IDLE: RouteCreation = { creating: false, computing: false };

// Creation of a route (mockup 10): a start, then an end. Touching the map
// again replaces the end and computes again. A point outside the zone is
// refused here, before the engine, so that the start is checked too.
export function useRouteCreation(bbox: Bbox) {
  const [state, setState] = useState<RouteCreation>(IDLE);
  // The current state, updated at the same time as the React state: two
  // touches before the next render must both see the first one.
  const current = useRef<RouteCreation>(IDLE);
  // Only the answer to the last request is kept.
  const lastRequest = useRef(0);

  const update = useCallback((next: RouteCreation) => {
    current.current = next;
    setState(next);
  }, []);

  const open = useCallback(() => update({ ...IDLE, creating: true }), [update]);

  const close = useCallback(() => {
    lastRequest.current += 1;
    update(IDLE);
  }, [update]);

  const touch = useCallback(
    (point: RoutePoint) => {
      const now = current.current;
      if (!now.creating || now.problem) return;
      if (!isInsideBbox(bbox, point.lon, point.lat)) {
        update({ ...now, problem: { kind: 'outOfZone', point, isEnd: false } });
        return;
      }
      const { start } = now;
      if (!start) {
        update({ ...now, start: point });
        return;
      }
      const request = ++lastRequest.current;
      update({ creating: true, start, end: point, computing: true });
      // The contract says it never rejects; an unexpected rejection is a
      // plain failure, so the screen never stays on "computing".
      const failed: RouteResult = { ok: false, error: 'failed' };
      void computeRoute([start, point])
        .catch(() => failed)
        .then((result) => {
          if (request !== lastRequest.current) return;
          const latest = current.current;
          update(
            result.ok
              ? { ...latest, computing: false, route: result }
              : {
                  ...latest,
                  computing: false,
                  problem: { kind: result.error, point, isEnd: true },
                },
          );
        });
    },
    [bbox, update],
  );

  // "Retirer ce point": the refused end goes away, a refused touch is dropped.
  const removeProblemPoint = useCallback(() => {
    const { problem, ...rest } = current.current;
    update(
      problem?.isEnd ? { ...rest, end: undefined, route: undefined } : rest,
    );
  }, [update]);

  return { state, open, close, touch, removeProblemPoint };
}
