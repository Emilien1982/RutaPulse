import type {
  MatchedEdgesResult,
  TraceRouteResult,
} from '@/core/routing/guidanceResponse';

import { routingEngine } from './routingEngine';

/** Directions along the shape, matched on the ways. Never throws. */
export function computeTraceRoute(
  shape: [number, number][],
  signal?: AbortSignal,
): Promise<TraceRouteResult> {
  return routingEngine.traceRoute(shape, signal);
}

/** Kind of way under the shape, matched on the ways. Never throws. */
export function computeMatchedEdges(
  shape: [number, number][],
  signal?: AbortSignal,
): Promise<MatchedEdgesResult> {
  return routingEngine.matchedEdges(shape, signal);
}
