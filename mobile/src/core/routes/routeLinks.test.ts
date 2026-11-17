import type { Draft } from '@/core/draft/draft';
import { buildRouteGpx } from '@/core/routes/exportGpx';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import {
  buildLine,
  sourceOfCreated,
  type TrackingSource,
} from '@/core/tracking/trackingLine';
import { createTracking, remainingOf } from '@/core/tracking/trackingState';

import type { LonLat, SavedLeg } from './savedRoute';
import { routeLinks, trackLengthKm, trackOfCreated } from './track';

// ADR 0021, section 10: the dotted links, drawn only.
const M_PER_DEG_LAT = 111_195;
const path = (shape: LonLat[], trace?: true): SavedLeg => ({
  mode: 'path',
  zoneVersion: 5,
  distanceKm: 1,
  durationS: 60,
  shape,
  ...(trace ? { trace } : {}),
});
const draftOf = (placed: LonLat[], modes: ('path' | 'hand')[]): Draft => ({
  points: placed.map(([lon, lat], i) => ({ id: i + 1, lon, lat })),
  modes,
});
// A point placed `m` meters north of `p`.
const north = (p: LonLat, m: number): LonLat => [
  p[0],
  p[1] + m / M_PER_DEG_LAT,
];

const A: LonLat = [6.18, 48.69];
const B: LonLat = [6.19, 48.7];
const shape: LonLat[] = [A, [6.185, 48.695], B];

describe('routeLinks', () => {
  it('draws a link at each end when the placed points are 50 m off', () => {
    const draft = draftOf([north(A, 50), north(B, 50)], ['path']);
    expect(routeLinks(draft, [path(shape)])).toEqual([
      [north(A, 50), A],
      [B, north(B, 50)],
    ]);
  });

  it('draws nothing when the placed points are 3 m off', () => {
    const draft = draftOf([north(A, 3), north(B, 3)], ['path']);
    expect(routeLinks(draft, [path(shape)])).toEqual([]);
  });

  it('draws nothing for a hand leg', () => {
    const draft = draftOf([north(A, 50), north(B, 50)], ['hand']);
    expect(routeLinks(draft, [{ mode: 'hand' }])).toEqual([]);
  });

  it('draws nothing for a leg kept from a trace', () => {
    const draft = draftOf([north(A, 50), north(B, 50)], ['path']);
    expect(routeLinks(draft, [path(shape, true)])).toEqual([]);
  });

  it('gives two links to a point between two computed legs', () => {
    const C: LonLat = [6.2, 48.71];
    const middle = north(B, 40);
    const draft = draftOf([A, middle, C], ['path', 'path']);
    const links = routeLinks(draft, [path([A, B]), path([B, C])]);
    expect(links).toEqual([
      [B, middle],
      [middle, B],
    ]);
  });
});

describe('a link changes nothing', () => {
  const route = sampleCreated({
    draft: draftOf([north(A, 50), north(B, 50)], ['path']),
    legs: [path(shape)],
  });
  const { draft, legs } = route;
  const track = trackOfCreated(draft, legs);

  it('is listed apart from the line of the tracking', () => {
    const source = sourceOfCreated(draft, legs, null);
    expect(source.links).toEqual(routeLinks(draft, legs));
    expect(source.links?.length).toBe(2);
    // The line is the track: no placed point in it.
    expect(source.line.points).toEqual(track);
    expect(source.line.points).toEqual(shape);
    expect(source.line.lengthM).toBeCloseTo(buildLine(track).lengthM, 6);
  });

  it('keeps the line, the length, the directions and the GPX', () => {
    const withLinks = sourceOfCreated(draft, legs, null);
    const without: TrackingSource = {
      line: withLinks.line,
      free: withLinks.free,
    };
    expect(withLinks.line).toEqual(buildLine(track));
    const a = createTracking(withLinks, 0);
    const b = createTracking(without, 0);
    expect(a.directions).toEqual(b.directions);
    expect(remainingOf(a)).toBe(remainingOf(b));
    expect(trackLengthKm(track)).toBeCloseTo(withLinks.line.lengthM / 1000, 2);
    const gpx = buildRouteGpx({ ...route, id: 1, readable: true }, null).text;
    for (const [lon, lat] of [north(A, 50), north(B, 50)]) {
      expect(gpx).not.toContain(`lat="${lat}"`);
      expect(gpx).not.toContain(`lon="${lon}" lat="${lat}"`);
    }
    expect(gpx.match(/<trkpt /g)?.length).toBe(track.length);
  });
});
