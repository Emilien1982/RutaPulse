// Asks the engine for the directions, once, at the start of the tracking
// (ADR 0021, section 1.1): one `trace_route` and one `matchedEdges` per
// guided part. Until the answer comes, the whole line is "Suivez le tracé".

import { useEffect } from 'react';

import {
  buildGuidance,
  partShape,
  type PartAnswer,
} from '@/core/tracking/guidance';
import type { TrackingEvent } from '@/core/tracking/trackingState';
import { guidedParts, type TrackingSource } from '@/core/tracking/trackingLine';
import {
  computeMatchedEdges,
  computeTraceRoute,
} from '@/shared-data/routing/computeGuidance';

export function useDirections(
  source: TrackingSource,
  dispatch: (event: TrackingEvent) => void,
) {
  useEffect(() => {
    const abort = new AbortController();
    const parts = guidedParts(source.line, source.free);
    if (parts.length === 0) return;
    void (async () => {
      const answers: PartAnswer[] = [];
      for (const part of parts) {
        const shape = partShape(source.line, part);
        const trace = await computeTraceRoute(shape, abort.signal);
        const edges = trace.ok
          ? await computeMatchedEdges(shape, abort.signal)
          : null;
        answers.push({ trace, edges });
      }
      if (abort.signal.aborted) return;
      dispatch({
        type: 'guidance',
        directions: buildGuidance(source, answers),
      });
    })();
    return () => abort.abort();
  }, [source, dispatch]);
}
