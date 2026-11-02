// What the Infos screen shows, block by block (ADR 0017, sections 4 and 8).
// Never throws.

import type {
  HeightResult,
  TraceResult,
  TerrainEdge,
} from '../routing/infoResponse';
import { handLeg, type Leg } from '../draft/legs';
import { ascentDescent } from './elevation';
import {
  elevationRange,
  heightsOf,
  joinProfiles,
  profileLength,
} from './profile';
import {
  handSegment,
  terrainSegments,
  terrainShares,
  type TerrainSegment,
  type TerrainShare,
} from './terrain';

/** Input for one leg. `undefined` = request not finished. */
export type LegInfo = {
  mode: 'path' | 'hand';
  /** Straight-line length of a hand leg (km). */
  handKm: number;
  height: HeightResult | undefined;
  /** Not used for a hand leg. */
  terrain: TraceResult | undefined;
};

export type Block<T> =
  { status: 'pending' } | { status: 'missing' } | ({ status: 'ready' } & T);

export type AltitudeInfo = {
  ascentM: number;
  descentM: number;
  minM: number;
  maxM: number;
  /** Joined profile: [distance m, altitude m]. */
  profile: [number, number][];
};

export type TerrainInfo = {
  shares: TerrainShare[];
  /** Along the profile; empty when the altitudes are not ready. */
  segments: TerrainSegment[];
};

export type RouteInfo = {
  altitudes: Block<AltitudeInfo>;
  terrain: Block<TerrainInfo>;
  /** Total length of the hand legs (km). */
  handKm: number;
};

/** Total "À la main" length of the legs (km). */
export function handLengthKm(legs: Leg[]): number {
  return legs
    .filter((leg) => leg.mode === 'hand')
    .reduce((sum, leg) => sum + handLeg(leg.from, leg.to).distanceKm, 0);
}

function altitudes(legs: LegInfo[]): Block<AltitudeInfo> {
  if (legs.length === 0) return { status: 'missing' };
  const broken = (leg: LegInfo) =>
    !!leg.height && (!leg.height.ok || heightsOf(leg.height.profile) === null);
  if (legs.some(broken)) return { status: 'missing' };
  if (legs.some((leg) => !leg.height)) return { status: 'pending' };
  const profiles = legs.map((leg) =>
    leg.height && leg.height.ok ? leg.height.profile : [],
  );
  const joined = joinProfiles(profiles);
  const heights = heightsOf(joined);
  const range = elevationRange(joined);
  if (!heights || !range) return { status: 'missing' };
  return {
    status: 'ready',
    ...ascentDescent(heights),
    ...range,
    profile: joined as [number, number][],
  };
}

function terrain(
  legs: LegInfo[],
  alt: Block<AltitudeInfo>,
  handKm: number,
): Block<TerrainInfo> {
  if (legs.length === 0) return { status: 'missing' };
  const paths = legs.filter((leg) => leg.mode === 'path');
  if (paths.some((leg) => leg.terrain && !leg.terrain.ok)) {
    return { status: 'missing' };
  }
  if (paths.some((leg) => !leg.terrain)) return { status: 'pending' };
  const edges: TerrainEdge[] = paths.flatMap((leg) =>
    leg.terrain && leg.terrain.ok ? leg.terrain.edges : [],
  );
  const shares = terrainShares(edges, handKm);
  if (!shares) return { status: 'missing' };
  const segments: TerrainSegment[] = [];
  if (alt.status === 'ready') {
    let offset = 0;
    for (const leg of legs) {
      const profile = leg.height && leg.height.ok ? leg.height.profile : [];
      const length = profileLength(profile);
      if (leg.mode === 'hand') segments.push(handSegment(length, offset));
      else if (leg.terrain && leg.terrain.ok) {
        segments.push(...terrainSegments(leg.terrain.edges, length, offset));
      }
      offset += length;
    }
  }
  return { status: 'ready', shares, segments };
}

/**
 * Each block is ready, pending or missing, independently. A failure wins
 * over a request still running (the block will not become ready).
 */
export function summarizeInfo(legs: LegInfo[]): RouteInfo {
  const alt = altitudes(legs);
  const handKm = legs.reduce(
    (sum, leg) => (leg.mode === 'hand' ? sum + leg.handKm : sum),
    0,
  );
  return { altitudes: alt, terrain: terrain(legs, alt, handKm), handKm };
}
