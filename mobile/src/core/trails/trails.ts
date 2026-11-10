// The waymarked circuits of a zone (`trails.geojson`, ADR 0020, sections 1
// and 9). Pure logic: reading the file, the light copy for the map, and the
// order of circuits under a finger.

import { trackLengthM } from '@/core/gpx/trackLengthM';
import { t } from '@/core/i18n/t';
import { nearestOnLine } from '@/core/routes/traceDraft';
import type { LonLat } from '@/core/routes/savedRoute';

export type Refusal = 'parts' | 'branches' | 'removedTooMuch';

/**
 * `ordered`: the fabric made a line in the order of the circuit.
 * `refused`: it could not (the file says why).
 * `old`: the key `ordered` is absent, the zone is older than the phase 7.
 */
export type TrailLine =
  | {
      kind: 'ordered';
      ordered: LonLat[];
      loop: boolean;
      orderedM: number;
      removedM: number;
    }
  | { kind: 'refused'; reason: Refusal }
  | { kind: 'old' };

export type Trail = {
  osmId: number;
  name?: string;
  ref?: string;
  colour?: string;
  /** Sum of the raw ways, in meters (`length_m`). */
  lengthM: number;
  /** The raw ways: what is waymarked on the ground. */
  ways: LonLat[][];
  line: TrailLine;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLonLat(value: unknown): value is LonLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function toLine(value: unknown): LonLat[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  if (!value.every(isLonLat)) return null;
  return value.map((p) => [p[0], p[1]]);
}

function toWays(geometry: unknown): LonLat[][] {
  if (!isObject(geometry)) return [];
  const coordinates = geometry.coordinates;
  const lists =
    geometry.type === 'MultiLineString'
      ? coordinates
      : geometry.type === 'LineString'
        ? [coordinates]
        : [];
  if (!Array.isArray(lists)) return [];
  const ways: LonLat[][] = [];
  for (const list of lists) {
    const way = toLine(list);
    if (way) ways.push(way);
  }
  return ways;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function toRefusal(value: unknown): Refusal {
  return value === 'parts' || value === 'removedTooMuch' ? value : 'branches';
}

function toLineState(p: Record<string, unknown>): TrailLine {
  if (!('ordered' in p)) return { kind: 'old' };
  if (p.ordered === null)
    return { kind: 'refused', reason: toRefusal(p.refusal) };
  const ordered = toLine(p.ordered);
  if (!ordered) return { kind: 'refused', reason: 'branches' };
  const orderedM =
    typeof p.ordered_m === 'number' && p.ordered_m >= 0
      ? p.ordered_m
      : trackLengthM(ordered);
  return {
    kind: 'ordered',
    ordered,
    loop: p.loop === true,
    orderedM,
    removedM:
      typeof p.removed_m === 'number' && p.removed_m > 0 ? p.removed_m : 0,
  };
}

/** Reads `trails.geojson`. Never throws: unreadable gives an empty list. */
export function parseTrails(source: string | null): Trail[] {
  let data: unknown;
  try {
    data = JSON.parse(source ?? '');
  } catch {
    return [];
  }
  if (!isObject(data) || !Array.isArray(data.features)) return [];
  const trails: Trail[] = [];
  for (const feature of data.features) {
    if (!isObject(feature) || !isObject(feature.properties)) continue;
    const p = feature.properties;
    if (typeof p.osm_id !== 'number' || !Number.isFinite(p.osm_id)) continue;
    const ways = toWays(feature.geometry);
    if (ways.length === 0) continue;
    trails.push({
      osmId: p.osm_id,
      name: text(p.name),
      ref: text(p.ref),
      colour: text(p.colour),
      lengthM:
        typeof p.length_m === 'number' && p.length_m >= 0
          ? p.length_m
          : ways.reduce((sum, way) => sum + trackLengthM(way), 0),
      ways,
      line: toLineState(p),
    });
  }
  return trails;
}

/** "Circuit {ref}", but the ref "Circuit 3" stays "Circuit 3". */
export function refLabel(ref: string): string {
  return /^circuit\b/i.test(ref.trim())
    ? ref.trim()
    : t('trails.refLabel', { ref });
}

/** The label along the line; empty when the circuit has no name nor number. */
export function mapLabel(trail: Trail): string {
  if (trail.name) return trail.name;
  return trail.ref ? refLabel(trail.ref) : '';
}

export type TrailsMapData = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { osm_id: number; label: string };
    geometry: { type: 'MultiLineString'; coordinates: LonLat[][] };
  }[];
};

/** The light copy for the map: the raw ways and a label, no ordered line. */
export function trailsToMapData(trails: readonly Trail[]): TrailsMapData {
  return {
    type: 'FeatureCollection',
    features: trails.map((trail) => ({
      type: 'Feature',
      properties: { osm_id: trail.osmId, label: mapLabel(trail) },
      geometry: { type: 'MultiLineString', coordinates: trail.ways },
    })),
  };
}

const METERS_PER_DEGREE = 111_195;

function distanceM(trail: Trail, position: LonLat): number {
  const cos = Math.cos((position[1] * Math.PI) / 180);
  let best = Infinity;
  for (const way of trail.ways) {
    const { point } = nearestOnLine(way, position);
    const dx = (point[0] - position[0]) * cos;
    const dy = point[1] - position[1];
    best = Math.min(best, Math.hypot(dx, dy) * METERS_PER_DEGREE);
  }
  return best;
}

/** Nearest line first, then the smallest `osmId`. */
export function sortByDistance(
  trails: readonly Trail[],
  position: LonLat,
): Trail[] {
  return trails
    .map((trail) => ({ trail, d: distanceM(trail, position) }))
    .sort((a, b) => a.d - b.d || a.trail.osmId - b.trail.osmId)
    .map((entry) => entry.trail);
}

/**
 * The chosen circuit, for the map: its ordered line when it has one (the
 * arrows follow the direction of the circuit), else its raw ways. Empty when
 * nothing is chosen.
 */
export function chosenToMapData(trail: Trail | null) {
  const line = trail?.line;
  return {
    type: 'FeatureCollection' as const,
    features: !trail
      ? []
      : [
          {
            type: 'Feature' as const,
            properties: { osm_id: trail.osmId },
            geometry:
              line?.kind === 'ordered'
                ? { type: 'LineString' as const, coordinates: line.ordered }
                : { type: 'MultiLineString' as const, coordinates: trail.ways },
          },
        ],
  };
}

/** [west, south, east, north] of all the ways of a circuit. */
export function trailBounds(trail: Trail): [number, number, number, number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const way of trail.ways) {
    for (const [lon, lat] of way) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  return [west, south, east, north];
}

/**
 * Where the creation will start, and end, for an ordered circuit (ADR 0020,
 * section 3): a loop starts at the point nearest to the position (or at the
 * beginning of the line) and ends there; a one-way circuit starts at its
 * beginning and ends at its end. Null when the order is unknown.
 */
export function plannedEnds(
  trail: Trail,
  position: LonLat | null,
): { start: LonLat; end: LonLat | null } | null {
  const line = trail.line;
  if (line.kind !== 'ordered') return null;
  const points = line.ordered;
  if (line.loop) {
    const start = position ? nearestOnLine(points, position).point : points[0];
    return { start, end: null };
  }
  return { start: points[0], end: points[points.length - 1] };
}
