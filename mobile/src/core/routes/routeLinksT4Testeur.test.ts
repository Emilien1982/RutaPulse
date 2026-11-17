// Tester's tests for T4 (C11), written from the spec and ADR 0021 section 10.
// Two holes seen by the reviewer: the directions once built, and a real circuit.

import type { Draft } from '@/core/draft/draft';
import { encodePolyline6 } from '@/core/routing/routeResponse';
import {
  parseTraceRouteResponse,
  type Maneuver,
} from '@/core/routing/guidanceResponse';
import { buildGuidance, type PartAnswer } from '@/core/tracking/guidance';
import {
  sourceOfCreated,
  type TrackingSource,
} from '@/core/tracking/trackingLine';
import type { Bbox } from '@/core/zones/catalogue';

import nancy from './fixtures/nancyCircuits.json';
import { legKey } from './reopen';
import type { LonLat, SavedLeg } from './savedRoute';
import { routeLinks, trackOfCreated } from './track';
import { traceToDraft } from './traceDraft';

const M_PER_DEG_LAT = 111_195;
const north = (p: LonLat, m: number): LonLat => [
  p[0],
  p[1] + m / M_PER_DEG_LAT,
];

function answerOn(points: LonLat[], maneuvers: Maneuver[]): PartAnswer {
  return {
    trace: parseTraceRouteResponse(
      JSON.stringify({
        trip: {
          legs: [
            {
              shape: encodePolyline6(points),
              maneuvers: maneuvers.map((m) => ({
                type: m.type,
                begin_shape_index: m.beginShapeIndex,
              })),
            },
          ],
        },
      }),
    ),
    edges: null,
  };
}

describe('C11: a link changes nothing to the directions once built', () => {
  // An L-shaped computed leg: east 600 m, then north 600 m (a left turn).
  const A: LonLat = [6.18, 48.69];
  const dLon = 600 / (M_PER_DEG_LAT * Math.cos((48.69 * Math.PI) / 180));
  const corner: LonLat = [A[0] + dLon, A[1]];
  const B: LonLat = north(corner, 600);
  const shape: LonLat[] = [A, corner, B];
  // Placed points 50 m off the way: two links.
  const draft: Draft = {
    points: [north(A, 50), north(B, 50)].map(([lon, lat], i) => ({
      id: i + 1,
      lon,
      lat,
    })),
    modes: ['path'],
  };
  const legs: SavedLeg[] = [
    {
      mode: 'path',
      zoneVersion: 5,
      distanceKm: 1.2,
      durationS: 300,
      shape,
    },
  ];

  it('has links on this route (the test is not empty)', () => {
    expect(routeLinks(draft, legs).length).toBe(2);
  });

  it('gives the same directions with and without the links', () => {
    const withLinks = sourceOfCreated(draft, legs, {
      lonMin: 5,
      latMin: 48,
      lonMax: 7,
      latMax: 49,
    });
    expect(withLinks.links?.length).toBe(2);
    const without: TrackingSource = {
      line: withLinks.line,
      free: withLinks.free,
    };
    const answers = [
      answerOn(trackOfCreated(draft, legs), [
        { type: 1, beginShapeIndex: 0 },
        { type: 15, beginShapeIndex: 1 },
        { type: 4, beginShapeIndex: 2 },
      ]),
    ];
    const a = buildGuidance(withLinks, answers);
    const b = buildGuidance(without, answers);
    // The list is really built: it has a turn, not only "follow the track".
    expect(a.some((d) => d.kind === 'turn')).toBe(true);
    expect(a).toEqual(b);
  });
});

describe('C11: a real circuit of Nancy kept from a trace has no link', () => {
  const NANCY: Bbox = {
    lonMin: 5.84,
    latMin: 48.47,
    lonMax: 6.52,
    latMax: 48.92,
  };
  const circuits = nancy.circuits as unknown as { ordered: LonLat[] }[];

  it.each([0, 1])('circuit %i: routeLinks is empty', (idx) => {
    const r = traceToDraft(circuits[idx].ordered, {
      loop: true,
      position: null,
      zoneVersion: 6,
      bbox: NANCY,
    });
    const pts = r.state.draft.points;
    expect(pts.length).toBeGreaterThan(2);
    const legs = pts.slice(1).map((b, i) => {
      const a = pts[i];
      const leg = r.kept.get(
        legKey({ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat }),
      );
      if (!leg) throw new Error('leg missing');
      // As saved by the app: a computed leg (mode path), trace flag kept.
      return {
        mode: 'path',
        zoneVersion: leg.zoneVersion,
        distanceKm: leg.distanceKm,
        durationS: leg.durationS,
        shape: leg.shape as LonLat[],
        ...(leg.trace ? { trace: true as const } : {}),
      } satisfies SavedLeg;
    });
    expect(legs.every((l) => l.mode === 'path' && l.trace === true)).toBe(true);
    expect(routeLinks(r.state.draft, legs)).toEqual([]);
  });
});
