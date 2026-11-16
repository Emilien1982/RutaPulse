// The real ascent of the ride (ADR 0021, section 4): one `height` request at
// the end, on the positions kept. Never the altitude of the GPS.

import { useEffect, useState } from 'react';

import { rideAscentM, rideHeightShape, type Ride } from '@/core/tracking/ride';
import type { Bbox } from '@/core/zones/catalogue';
import { computeHeights } from '@/shared-data/routing/computeInfos';

/** Undefined while the engine answers; null when the ascent is unknown ("—"). */
export function useRideAscent(
  ride: Ride,
  bbox: Bbox | null,
): number | null | undefined {
  // The ride and the zone are final when this runs: the tracking has ended.
  const [shape] = useState(() => rideHeightShape(ride, bbox));
  const [answer, setAnswer] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    if (!shape) return;
    const abort = new AbortController();
    void computeHeights(shape, abort.signal).then((result) => {
      if (!abort.signal.aborted) setAnswer(rideAscentM(result));
    });
    return () => abort.abort();
  }, [shape]);
  const ascent = shape ? answer : null;
  return ascent;
}
