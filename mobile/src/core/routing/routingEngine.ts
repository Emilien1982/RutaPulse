// Life cycle of the calculation engine (ADR 0015, sections 3 and 4). The
// native module is a parameter, so that the logic runs without a phone.
// Everything goes through one queue: one call at a time.

import type { Bbox, Zone } from '../zones/catalogue';
import { isInsideBbox } from '../zones/activeZone';
import { buildRouteRequest, type RoutePoint } from './routeRequest';
import {
  failure,
  kindFromNativeError,
  parseRouteResponse,
  type RouteResult,
} from './routeResponse';

export type NativeRouting = {
  open(tarPath: string, elevationDir: string): Promise<void>;
  close(): Promise<void>;
  route(requestJson: string): Promise<string>;
};

export type EnginePaths = { tarPath: string; elevationDir: string };

export type EngineState = 'closed' | 'opening' | 'open' | 'failed';

export type RoutingEngine = {
  /** Opens the engine on this zone; null closes it. */
  setZone(zone: Zone | null): void;
  /** Never rejects. Calls wait in line, one at a time. */
  route(points: RoutePoint[]): Promise<RouteResult>;
  getState(): EngineState;
};

type Run = {
  state: EngineState;
  bbox: Bbox | null;
  openError: RouteResult | null;
};

export function createRoutingEngine(
  native: NativeRouting,
  pathsOf: (zone: Zone) => EnginePaths,
): RoutingEngine {
  let tail: Promise<unknown> = Promise.resolve();
  let state: EngineState = 'closed';
  let wanted: Zone | null = null;
  // What the queue has done so far; a call reads this when its turn comes.
  const run: Run = { state: 'closed', bbox: null, openError: null };

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  }

  function sameZone(a: Zone | null, b: Zone | null): boolean {
    return a?.id === b?.id && a?.version === b?.version;
  }

  return {
    getState: () => state,

    setZone(zone) {
      if (sameZone(zone, wanted)) return;
      wanted = zone;
      state = zone ? 'opening' : 'closed';
      void enqueue(async () => {
        if (run.state !== 'closed') {
          try {
            await native.close();
          } catch {
            // Closing an engine that is already gone is not an error.
          }
          run.state = 'closed';
          run.bbox = null;
          run.openError = null;
        }
        if (!zone) return;
        try {
          const paths = pathsOf(zone);
          await native.open(paths.tarPath, paths.elevationDir);
          run.state = 'open';
          run.bbox = zone.bbox;
          if (wanted === zone) state = 'open';
        } catch (error) {
          run.state = 'failed';
          run.openError = failure(kindFromNativeError(error));
          // An open that fails with another code is a plain failure.
          if (
            run.openError.ok === false &&
            run.openError.error === 'engineUnavailable'
          ) {
            run.openError = failure('failed');
          }
          if (wanted === zone) state = 'failed';
        }
      });
    },

    route(points) {
      return enqueue(async (): Promise<RouteResult> => {
        try {
          if (run.state === 'failed' && run.openError) return run.openError;
          if (run.state !== 'open' || !run.bbox) {
            return failure('engineUnavailable');
          }
          if (points.length < 2) return failure('failed');
          const bbox = run.bbox;
          if (points.some((p) => !isInsideBbox(bbox, p.lon, p.lat))) {
            return failure('outOfZone');
          }
          const text = await native.route(buildRouteRequest(points));
          return parseRouteResponse(text);
        } catch (error) {
          return failure(kindFromNativeError(error));
        }
      });
    },
  };
}
