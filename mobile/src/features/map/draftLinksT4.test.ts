import type { Draft } from '@/core/draft/draft';
import type { LonLat, SavedLeg } from '@/core/routes/savedRoute';
import { routeLinks } from '@/core/routes/track';

import { mainGeometry } from './draftGeometry';
import type { LegState } from './useLegResults';

const M_PER_DEG_LAT = 111_195;
const north = (p: LonLat, m: number): LonLat => [
  p[0],
  p[1] + m / M_PER_DEG_LAT,
];
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
const A: LonLat = [6.18, 48.69];
const B: LonLat = [6.19, 48.7];

describe('mainGeometry and routeLinks', () => {
  it('give the same links on a route with a point off the path and a trace leg', () => {
    const C: LonLat = [6.2, 48.71];
    const D: LonLat = [6.21, 48.72];
    const draft = draftOf(
      [north(A, 50), north(B, 30), north(C, 60), D],
      ['path', 'path', 'path'],
    );
    const legs: SavedLeg[] = [path([A, B]), path([B, C]), path([C, D], true)];
    const states: LegState[] = legs.map((leg) => {
      if (leg.mode !== 'path') throw new Error('path only');
      return {
        status: 'done',
        result: { shape: leg.shape } as never,
        ...(leg.trace ? { trace: true as const } : {}),
      };
    });
    const geometry = mainGeometry(draft, states, null);
    expect(geometry.links.features.map((f) => f.geometry.coordinates)).toEqual(
      routeLinks(draft, legs),
    );
    expect(geometry.links.features.length).toBeGreaterThan(0);
  });
});
