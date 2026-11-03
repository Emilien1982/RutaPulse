// A saved route built from a GPX file that was read (ADR 0019, section 7).
// Pure logic.

import { HAND_SPEED_KMH } from '@/core/draft/legs';

import type { GpxResult } from '@/core/gpx/readGpx';
import { trackLengthM } from '@/core/gpx/trackLengthM';
import { isInsideBbox } from '@/core/zones/activeZone';
import type { Zone } from '@/core/zones/catalogue';

import { MAX_NAME_LENGTH, normalizeName } from './routeName';
import type { GpxRoute } from './savedRoute';
import { previewOf } from './track';

/** A new GPX route. No `name`: the caller gives the default name. */
export type ImportedRoute = Omit<GpxRoute, 'id' | 'readable' | 'name'> & {
  name?: string;
};

/** The name of the file without ".gpx", normalized, 60 characters at most. */
function nameOfFile(fileName: string): string {
  const name = normalizeName(fileName)
    .replace(/\.gpx$/i, '')
    .trim();
  return [...name].slice(0, MAX_NAME_LENGTH).join('').trim();
}

/**
 * Name: the one of the file, else the name of the GPX file, else none.
 * Zone: the zone in service, when it holds the start. Duration: 10 km/h.
 */
export function buildImportedRoute(
  gpx: Extract<GpxResult, { ok: true }>,
  fileName: string,
  zoneInService: Zone | null,
  now: number,
): ImportedRoute {
  const distanceKm = trackLengthM(gpx.track) / 1000;
  const name = normalizeName(gpx.name) || nameOfFile(fileName);
  const known = gpx.elevations.some((e) => e !== null);
  const start = gpx.track[0];
  const inZone =
    zoneInService !== null &&
    isInsideBbox(zoneInService.bbox, start[0], start[1]);
  return {
    ...(name === '' ? {} : { name }),
    origin: 'gpx',
    createdAt: now,
    savedAt: now,
    zone:
      inZone && zoneInService
        ? {
            id: zoneInService.id,
            version: zoneInService.version,
            name: zoneInService.name,
          }
        : null,
    preview: previewOf(gpx.track),
    distanceKm,
    durationS: Math.round((distanceKm / HAND_SPEED_KMH) * 3600),
    ascentM: null,
    descentM: null,
    figuresAt: null,
    track: gpx.track,
    elevations: known ? gpx.elevations : null,
  };
}
