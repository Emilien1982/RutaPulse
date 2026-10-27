import type { RoutePoint } from '@/core/routing/routeRequest';
import type { RouteResult } from '@/core/routing/routeResponse';

import { routingEngine } from './routingEngine';

/** Route through the points. Never throws: errors come back in the result. */
export function computeRoute(
  points: RoutePoint[],
  signal?: AbortSignal,
): Promise<RouteResult> {
  return routingEngine.route(points, signal);
}
