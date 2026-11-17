// The line followed during the tracking, and its parts with and without
// directions (ADR 0021, sections 1.1 and 2.1). Pure logic.

import type { Draft } from '@/core/draft/draft';
import { VALHALLA_EARTH_RADIUS_M } from '@/core/gpx/trackLengthM';
import type { LonLat, SavedLeg } from '@/core/routes/savedRoute';
import { MAX_ENGINE_POINTS, routeLinks, thinTrack } from '@/core/routes/track';
import type { Bbox } from '@/core/zones/catalogue';

const RAD = Math.PI / 180;
/** Meters in one degree of latitude, on the sphere of the engine. */
const M_PER_DEG = RAD * VALHALLA_EARTH_RADIUS_M;

/**
 * The points of the line, their cumulated distances on the sphere of the
 * engine, and their coordinates in a local plane in meters (longitude times
 * the cosine of the mean latitude, ADR 0020 section 3).
 */
export type TrackingLine = {
  points: LonLat[];
  /** Distance from the first point to each point (m). */
  cumM: number[];
  xs: number[];
  ys: number[];
  lengthM: number;
  lon0: number;
  lat0: number;
  /** Meters in one degree of longitude. */
  kx: number;
};

/** Great-circle distance (m), on the sphere of the engine. */
export function distanceM(a: readonly number[], b: readonly number[]): number {
  const dLat = ((b[1] as number) - (a[1] as number)) * RAD;
  const dLon = ((b[0] as number) - (a[0] as number)) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] as number) * RAD) *
      Math.cos((b[1] as number) * RAD) *
      Math.sin(dLon / 2) ** 2;
  return 2 * VALHALLA_EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function buildLine(points: readonly LonLat[]): TrackingLine {
  const first = points[0] ?? [0, 0];
  let latSum = 0;
  for (const p of points) latSum += p[1];
  const lat0 = points.length > 0 ? latSum / points.length : 0;
  const kx = M_PER_DEG * Math.cos(lat0 * RAD);
  const cumM: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  let total = 0;
  points.forEach((p, i) => {
    if (i > 0) total += distanceM(points[i - 1] as LonLat, p);
    cumM.push(total);
    xs.push((p[0] - first[0]) * kx);
    ys.push((p[1] - lat0) * M_PER_DEG);
  });
  return {
    points: [...points],
    cumM,
    xs,
    ys,
    lengthM: total,
    lon0: first[0],
    lat0,
    kx,
  };
}

/** [x, y] of a point in the plane of the line (m). */
export function toPlane(
  line: TrackingLine,
  p: readonly number[],
): [number, number] {
  return [
    ((p[0] as number) - line.lon0) * line.kx,
    ((p[1] as number) - line.lat0) * M_PER_DEG,
  ];
}

/** Compass bearing (degrees, 0 = north, clockwise) from a to b. */
export function bearingBetween(
  a: readonly number[],
  b: readonly number[],
): number {
  const dx =
    ((b[0] as number) - (a[0] as number)) *
    Math.cos((((a[1] as number) + (b[1] as number)) * RAD) / 2);
  const dy = (b[1] as number) - (a[1] as number);
  return (Math.atan2(dx, dy) / RAD + 360) % 360;
}

/** Smallest angle between two bearings (0 to 180). */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Index i of the segment i..i+1 that holds the distance `m`. */
function segmentAt(line: TrackingLine, m: number): number {
  let lo = 0;
  let hi = line.points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((line.cumM[mid + 1] as number) < m) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo);
}

/** The point of the line at distance `m` (kept between the ends). */
export function pointAt(line: TrackingLine, m: number): LonLat {
  const n = line.points.length;
  if (n < 2) return (line.points[0] ?? [0, 0]) as LonLat;
  const d = Math.min(Math.max(m, 0), line.lengthM);
  const i = segmentAt(line, d);
  const a = line.points[i] as LonLat;
  const b = line.points[i + 1] as LonLat;
  const len = (line.cumM[i + 1] as number) - (line.cumM[i] as number);
  const f = len > 0 ? (d - (line.cumM[i] as number)) / len : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** The points of the line between two distances, ends included. */
export function sliceLine(
  line: TrackingLine,
  fromM: number,
  toM: number,
): LonLat[] {
  const out: LonLat[] = [pointAt(line, fromM)];
  line.points.forEach((p, i) => {
    const m = line.cumM[i] as number;
    if (m > fromM && m < toM) out.push(p);
  });
  out.push(pointAt(line, toM));
  return out;
}

export type FreeReason = 'hand' | 'outOfZone' | 'noMatch';

/** A stretch of the line without directions (distances along the line). */
export type FreePart = { fromM: number; toM: number; reason: FreeReason };

/**
 * The line and the stretches that never get directions from the engine, and
 * the dotted links to the points placed (drawn only: never part of the line,
 * ADR 0021, section 10).
 */
export type TrackingSource = {
  line: TrackingLine;
  free: FreePart[];
  /** Optional only so that the sources written before 8b still type. */
  links?: LonLat[][];
};

/** Index ranges of a line, in the order of the line. */
type IndexRange = { from: number; to: number; reason: FreeReason };

/** Sorts, cuts the overlaps (the earlier range wins) and drops the empty ones. */
export function normalizeFree(parts: readonly FreePart[]): FreePart[] {
  const sorted = [...parts].sort((a, b) => a.fromM - b.fromM || a.toM - b.toM);
  const out: FreePart[] = [];
  let end = 0;
  for (const part of sorted) {
    const fromM = Math.max(part.fromM, end);
    if (part.toM - fromM <= 0) continue;
    const last = out[out.length - 1];
    if (last && last.reason === part.reason && fromM <= last.toM) {
      last.toM = part.toM;
    } else {
      out.push({ fromM, toM: part.toM, reason: part.reason });
    }
    end = part.toM;
  }
  return out;
}

function rangesToFree(line: TrackingLine, ranges: IndexRange[]): FreePart[] {
  return normalizeFree(
    ranges.map((r) => ({
      fromM: line.cumM[r.from] as number,
      toM: line.cumM[r.to] as number,
      reason: r.reason,
    })),
  );
}

function allOutOfZone(line: TrackingLine): FreePart[] {
  return line.lengthM > 0
    ? [{ fromM: 0, toM: line.lengthM, reason: 'outOfZone' }]
    : [];
}

function insideBox(bbox: Bbox, [lon, lat]: LonLat): boolean {
  return (
    lon >= bbox.lonMin &&
    lon <= bbox.lonMax &&
    lat >= bbox.latMin &&
    lat <= bbox.latMax
  );
}

/**
 * The line of a created route, the same as `trackOfCreated`, with the
 * stretches that get no direction: hand legs, and legs with a point outside
 * the rectangle of the zone. `bbox` is null when the zone is not in service:
 * the whole line is then out of the zone.
 */
export function sourceOfCreated(
  draft: Draft,
  legs: SavedLeg[],
  bbox: Bbox | null,
): TrackingSource {
  const points: LonLat[] = [];
  const ranges: IndexRange[] = [];
  const push = (p: LonLat) => {
    const last = points[points.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p);
  };
  // A hand leg ends at the first point written after it.
  let openHand: IndexRange | null = null;
  const close = () => {
    if (openHand) openHand.to = points.length - 1;
    openHand = null;
  };
  legs.forEach((leg, i) => {
    const start = Math.max(0, points.length - 1);
    if (leg.mode === 'path') {
      leg.shape.forEach((p, k) => {
        push(p);
        if (k === 0) close();
      });
      if (bbox && !leg.shape.every((p) => insideBox(bbox, p))) {
        ranges.push({
          from: start,
          to: points.length - 1,
          reason: 'outOfZone',
        });
      }
      return;
    }
    const from = draft.points[i];
    const to = draft.points[i + 1];
    if (!from || !to) return;
    const range: IndexRange = { from: start, to: start, reason: 'hand' };
    ranges.push(range);
    if (legs[i - 1]?.mode !== 'path') {
      push([from.lon, from.lat]);
      close();
    }
    if (legs[i + 1]?.mode !== 'path') {
      push([to.lon, to.lat]);
      close();
    }
    range.to = points.length - 1;
    openHand = range;
  });
  close();
  const line = buildLine(points);
  const links = routeLinks(draft, legs);
  if (!bbox) return { line, free: allOutOfZone(line), links };
  return { line, free: rangesToFree(line, ranges), links };
}

/**
 * The line of an imported GPX (thinned when it has too many points) and its
 * stretches outside the rectangle of the zone (a segment with an end outside).
 */
export function sourceOfGpx(
  track: readonly LonLat[],
  bbox: Bbox | null,
): TrackingSource {
  const line = buildLine(thinTrack([...track], MAX_ENGINE_POINTS));
  if (!bbox) return { line, free: allOutOfZone(line), links: [] };
  const ranges: IndexRange[] = [];
  const out = line.points.map((p) => !insideBox(bbox, p));
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) continue;
    let end = i;
    while (end + 1 < out.length && out[end + 1]) end++;
    ranges.push({
      from: Math.max(0, i - 1),
      to: Math.min(out.length - 1, end + 1),
      reason: 'outOfZone',
    });
    i = end;
  }
  return { line, free: rangesToFree(line, ranges), links: [] };
}

/** The stretches between the free ones: they get directions from the engine. */
export function guidedParts(
  line: TrackingLine,
  free: readonly FreePart[],
): { fromM: number; toM: number }[] {
  const out: { fromM: number; toM: number }[] = [];
  let at = 0;
  for (const part of normalizeFree(free)) {
    if (part.fromM > at) out.push({ fromM: at, toM: part.fromM });
    at = part.toM;
  }
  if (line.lengthM > at) out.push({ fromM: at, toM: line.lengthM });
  return out;
}
