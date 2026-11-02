import type { HeightResult, TraceResult } from '@/core/routing/infoResponse';

import { routingEngine } from './routingEngine';

/** Altitudes along the shape. Never throws: errors come back in the result. */
export function computeHeights(
  shape: [number, number][],
  signal?: AbortSignal,
): Promise<HeightResult> {
  return routingEngine.height(shape, signal);
}

/** Terrain edges along the shape. Never throws. */
export function computeTerrain(
  shape: [number, number][],
  signal?: AbortSignal,
): Promise<TraceResult> {
  return routingEngine.traceAttributes(shape, signal);
}
