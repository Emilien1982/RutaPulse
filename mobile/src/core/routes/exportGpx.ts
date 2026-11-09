// The GPX file of a saved route (ADR 0019, section 8). Pure logic.

import { gpxFileName } from '../gpx/gpxFileName';
import { writeGpx } from '../gpx/writeGpx';
import type { CreatedRoute, GpxRoute, LonLat } from './savedRoute';
import { trackOfCreated } from './track';

/** The track to write: a created route has no link line, a GPX is as read. */
export function exportTrackOf(route: CreatedRoute | GpxRoute): LonLat[] {
  return route.origin === 'created'
    ? trackOfCreated(route.draft, route.legs)
    : route.track;
}

/**
 * Name and text of the file. `heights`: one altitude per point of
 * `exportTrackOf(route)` for a created route (null: none, no `<ele>`).
 * A GPX writes the altitudes of the file.
 */
export function buildRouteGpx(
  route: CreatedRoute | GpxRoute,
  heights: readonly (number | null)[] | null,
): { fileName: string; text: string } {
  const track = exportTrackOf(route);
  const elevations = route.origin === 'gpx' ? route.elevations : heights;
  return {
    fileName: gpxFileName(route.name),
    text: writeGpx({
      name: route.name,
      track,
      elevations: elevations ?? undefined,
    }),
  };
}
