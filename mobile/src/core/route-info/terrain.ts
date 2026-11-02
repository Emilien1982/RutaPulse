// Terrain classes of a route (ADR 0017, section 3). Rule of essay 1-bis.

import type { TerrainEdge } from '../routing/infoResponse';

/** Order = tie-break order of `roundShares`. */
export const TERRAIN_PARTS = ['road', 'track', 'trail', 'hand'] as const;
export type TerrainPart = (typeof TERRAIN_PARTS)[number];

/** From this density (Valhalla scale, tuned on Nancy) a path is a street. */
export const DENSITY_TOWN = 6;

const TRAIL_USES = new Set([
  'path',
  'footway',
  'mountain_bike',
  'cycleway',
  'pedestrian',
  'bridleway',
  'steps',
  'sidewalk',
]);

/** Road, track or trail. Never 'hand': that one is a whole leg. */
export function classifyEdge(edge: TerrainEdge): 'road' | 'track' | 'trail' {
  if (edge.use === 'track') return 'track';
  if (TRAIL_USES.has(edge.use) && edge.density < DENSITY_TOWN) return 'trail';
  return 'road';
}

/** Lengths in km by part, for the edges of several legs. */
export function terrainLengths(
  edges: TerrainEdge[],
  handKm: number,
): Record<TerrainPart, number> {
  const lengths: Record<TerrainPart, number> = {
    road: 0,
    track: 0,
    trail: 0,
    hand: handKm,
  };
  for (const edge of edges) lengths[classifyEdge(edge)] += edge.lengthKm;
  return lengths;
}

/**
 * Integer percentages that sum to 100 (largest remainder). Ties go to the
 * first part in the list. All zeros when the total is not positive.
 */
export function roundShares(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (!(total > 0)) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const result = exact.map((x) => Math.floor(x + 1e-9));
  let missing = 100 - result.reduce((sum, v) => sum + v, 0);
  const order = exact
    .map((x, index) => ({ index, rest: x - (result[index] as number) }))
    .sort((a, b) =>
      Math.abs(a.rest - b.rest) < 1e-9 ? a.index - b.index : b.rest - a.rest,
    );
  for (const { index } of order) {
    if (missing <= 0) break;
    result[index] = (result[index] as number) + 1;
    missing--;
  }
  return result;
}

export type TerrainShare = { part: TerrainPart; percent: number };

/**
 * Shares of the route. Road, track and trail are always listed; 'hand' only
 * when there is a hand leg (`handKm` > 0). Null when the base is empty.
 */
export function terrainShares(
  edges: TerrainEdge[],
  handKm: number,
): TerrainShare[] | null {
  const lengths = terrainLengths(edges, handKm);
  const parts = TERRAIN_PARTS.filter((p) => p !== 'hand' || handKm > 0);
  const total = parts.reduce((sum, p) => sum + lengths[p], 0);
  if (!(total > 0)) return null;
  const percents = roundShares(parts.map((p) => lengths[p]));
  return parts.map((part, i) => ({ part, percent: percents[i] as number }));
}

/** A stretch of the profile with one terrain part (distances in m). */
export type TerrainSegment = { part: TerrainPart; fromM: number; toM: number };

/**
 * Segments of one calculated leg, along the profile: neighbouring edges of
 * the same part are merged, positions are scaled to `legLengthM`.
 */
export function terrainSegments(
  edges: TerrainEdge[],
  legLengthM: number,
  offsetM: number,
): TerrainSegment[] {
  const sum = edges.reduce((s, e) => s + e.lengthKm, 0);
  if (!(sum > 0)) return [];
  const scale = legLengthM / sum;
  const segments: TerrainSegment[] = [];
  let at = offsetM;
  for (const edge of edges) {
    const toM = at + edge.lengthKm * scale;
    const part = classifyEdge(edge);
    const last = segments[segments.length - 1];
    if (last && last.part === part) last.toM = toM;
    else segments.push({ part, fromM: at, toM });
    at = toM;
  }
  return segments;
}

/** The segment of a hand leg. */
export function handSegment(
  legLengthM: number,
  offsetM: number,
): TerrainSegment {
  return { part: 'hand', fromM: offsetM, toM: offsetM + legLengthM };
}
