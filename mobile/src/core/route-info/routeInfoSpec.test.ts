// Tests written from the spec (p05, C2 C4 C5 C10 C11) and ADR 0017
// (sections 3, 4, 5, 8, 10), not from the code.

import { ascentDescent } from './elevation';
import { joinProfiles } from './profile';
import { handLengthKm, summarizeInfo, type LegInfo } from './routeInfo';
import { infoShape } from './legShape';
import {
  classifyEdge,
  roundShares,
  terrainSegments,
  terrainShares,
} from './terrain';
import { listLegs } from '../draft/legs';
import type { Draft } from '../draft/draft';
import {
  parseTraceResponse,
  type ProfilePoint,
  type TerrainEdge,
} from '../routing/infoResponse';

const bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };

const edge = (use: string, density: number | undefined, lengthKm = 1) =>
  ({ use, density, lengthKm }) as {
    use: string;
    density: number;
    lengthKm: number;
  };

const ok = (heights: (number | null)[]) => ({
  ok: true as const,
  profile: heights.map((h, i) => [i * 30, h] as ProfilePoint),
});
const trace = (edges: [string, number, number][]) => ({
  ok: true as const,
  edges: edges.map(([use, density, lengthKm]) => ({ use, density, lengthKm })),
});
const failed = { ok: false as const, error: 'failed' as const };
const pathLeg = (
  height: LegInfo['height'],
  terrain: LegInfo['terrain'],
): LegInfo => ({ mode: 'path', handKm: 0, height, terrain });
const handInfo = (height: LegInfo['height'], handKm: number): LegInfo => ({
  mode: 'hand',
  handKm,
  height,
  terrain: undefined,
});

// Small seeded generator (mulberry32) so the random cases are repeatable.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('C2 - ascent and descent on known profiles', () => {
  it('flat, empty and single-point profiles give 0 / 0', () => {
    expect(ascentDescent([])).toEqual({ ascentM: 0, descentM: 0 });
    expect(ascentDescent([100])).toEqual({ ascentM: 0, descentM: 0 });
    expect(ascentDescent([100, 100, 100])).toEqual({ ascentM: 0, descentM: 0 });
  });
  it('counts a rise of exactly 5 m (threshold is inclusive)', () => {
    expect(ascentDescent([100, 105])).toEqual({ ascentM: 5, descentM: 0 });
  });
  it('ignores a rise of 4 m', () => {
    expect(ascentDescent([100, 104])).toEqual({ ascentM: 0, descentM: 0 });
  });
  it('counts a drop of exactly 5 m, and ignores 4 m', () => {
    expect(ascentDescent([105, 100])).toEqual({ ascentM: 0, descentM: 5 });
    expect(ascentDescent([104, 100])).toEqual({ ascentM: 0, descentM: 0 });
  });
  it('a slow climb of 1 m per sample is counted once the 5 m are reached', () => {
    // ref 100; 101..104 below the threshold; 105 -> +5; 106..109 no; 110 -> +5.
    const slow = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
    expect(ascentDescent(slow)).toEqual({ ascentM: 10, descentM: 0 });
  });
  it('a slow descent of 1 m per sample is counted too', () => {
    const slow = [110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100];
    expect(ascentDescent(slow)).toEqual({ ascentM: 0, descentM: 10 });
  });
  it('a slow climb of 4 m in total stays at 0', () => {
    expect(ascentDescent([100, 101, 102, 103, 104])).toEqual({
      ascentM: 0,
      descentM: 0,
    });
  });
  it('general case worked by hand (method of essay 1, threshold 5 m)', () => {
    // Hand computation: up 100->108 (+8), drops 108->103->98 (5 + 5),
    // 98->109 (+11), 109->120 (+11), drop 120->114 (6); the rest is < 5 m.
    // D+ = 8 + 11 + 11 = 30 ; D- = 5 + 5 + 6 = 16.
    const h = [100, 104, 108, 103, 98, 101, 109, 120, 114, 110, 118];
    expect(ascentDescent(h)).toEqual({ ascentM: 30, descentM: 16 });
  });
  it('a drop of exactly 5 m resets the reference (then +5 counts)', () => {
    // 100 -> 95 (drop of exactly 5: reference becomes 95) -> 100 (+5): D+ = 5.
    // With a strict threshold on the drop, the reference would stay at 100.
    expect(ascentDescent([100, 95, 100])).toEqual({ ascentM: 5, descentM: 5 });
    // Mirror: 100 -> 105 -> 100.
    expect(ascentDescent([100, 105, 100])).toEqual({ ascentM: 5, descentM: 5 });
  });
  it('a rise then the same fall: D+ and D- are both counted', () => {
    expect(ascentDescent([100, 120, 100])).toEqual({
      ascentM: 20,
      descentM: 20,
    });
  });
});

describe('Joined profile vs sum per leg (ADR 0017, section 4)', () => {
  it('3 m + 3 m at a junction make 6 m (joined), not 0 (summed)', () => {
    const a = [100, 103];
    const b = [103, 106];
    expect(ascentDescent(a).ascentM + ascentDescent(b).ascentM).toBe(0);
    const info = summarizeInfo([
      pathLeg(ok(a), trace([['road', 0, 0.03]])),
      pathLeg(ok(b), trace([['road', 0, 0.03]])),
    ]);
    expect(info.altitudes).toMatchObject({ status: 'ready', ascentM: 6 });
  });
  it('3 m + 3 m of descent make 6 m of D-', () => {
    const info = summarizeInfo([
      pathLeg(ok([106, 103]), trace([['road', 0, 0.03]])),
      pathLeg(ok([103, 100]), trace([['road', 0, 0.03]])),
    ]);
    expect(info.altitudes).toMatchObject({ ascentM: 0, descentM: 6 });
  });
  it('shifts the distances of each leg by the length before it', () => {
    const joined = joinProfiles([
      [
        [0, 1],
        [30, 2],
        [55, 3],
      ],
      [
        [0, 3],
        [30, 4],
      ],
    ]);
    expect(joined).toEqual([
      [0, 1],
      [30, 2],
      [55, 3],
      [55, 3],
      [85, 4],
    ]);
  });
  it('joining nothing, or empty profiles, does not throw', () => {
    expect(joinProfiles([])).toEqual([]);
    expect(joinProfiles([[], []])).toEqual([]);
  });
  it('splitting a climb in two legs does not change D+ (same altitudes)', () => {
    const all = [100, 102, 104, 106, 108, 110, 112];
    const whole = summarizeInfo([pathLeg(ok(all), trace([['road', 0, 1]]))]);
    const split = summarizeInfo([
      pathLeg(ok(all.slice(0, 4)), trace([['road', 0, 1]])),
      pathLeg(ok(all.slice(3)), trace([['road', 0, 1]])),
    ]);
    if (whole.altitudes.status !== 'ready') throw new Error('not ready');
    if (split.altitudes.status !== 'ready') throw new Error('not ready');
    expect(split.altitudes.ascentM).toBe(whole.altitudes.ascentM);
    expect(whole.altitudes.ascentM).toBe(12);
  });
  it('gives the lowest and highest altitude of the joined profile', () => {
    const info = summarizeInfo([
      pathLeg(ok([200, 250]), trace([['road', 0, 1]])),
      pathLeg(ok([250, 180, 190]), trace([['road', 0, 1]])),
    ]);
    expect(info.altitudes).toMatchObject({ minM: 180, maxM: 250 });
  });
});

describe('C4 - hand legs count in the ascent and the profile', () => {
  it('a hand leg alone has D+, D- and a profile', () => {
    const info = summarizeInfo([handInfo(ok([100, 110, 120]), 0.06)]);
    if (info.altitudes.status !== 'ready') throw new Error('not ready');
    expect(info.altitudes.ascentM).toBe(20);
    expect(info.altitudes.profile).toHaveLength(3);
  });
  it('a hand leg in the middle adds its climb', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 100]), trace([['road', 0, 0.03]])),
      handInfo(ok([100, 130]), 0.03),
      pathLeg(ok([130, 130]), trace([['road', 0, 0.03]])),
    ]);
    if (info.altitudes.status !== 'ready') throw new Error('not ready');
    expect(info.altitudes.ascentM).toBe(30);
    expect(info.altitudes.profile.map((p) => p[0])).toEqual([
      0, 30, 30, 60, 60, 90,
    ]);
  });
  it('a hand leg without altitudes makes the whole altitude block missing', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 110]), trace([['road', 0, 1]])),
      handInfo(failed, 0.1),
    ]);
    expect(info.altitudes).toEqual({ status: 'missing' });
  });
});

describe('C5 - terrain rule, each use', () => {
  it.each([
    ['track', 0, 'track'],
    ['track', 9, 'track'],
    ['path', 0, 'trail'],
    ['footway', 3, 'trail'],
    ['mountain_bike', 5, 'trail'],
    ['cycleway', 1, 'trail'],
    ['pedestrian', 2, 'trail'],
    ['bridleway', 0, 'trail'],
    ['steps', 4, 'trail'],
    ['sidewalk', 1, 'trail'],
    ['road', 0, 'road'],
    ['service_road', 2, 'road'],
    ['living_street', 3, 'road'],
    ['driveway', 0, 'road'],
    ['something_unknown', 0, 'road'],
    ['', 0, 'road'],
  ] as const)('use %s density %s -> %s', (use, density, expected) => {
    expect(classifyEdge(edge(use, density))).toBe(expected);
  });
  it('density 5 stays a trail, density 6 becomes a road (town)', () => {
    for (const use of [
      'path',
      'footway',
      'mountain_bike',
      'cycleway',
      'pedestrian',
      'bridleway',
      'steps',
      'sidewalk',
    ]) {
      expect(classifyEdge(edge(use, 5))).toBe('trail');
      expect(classifyEdge(edge(use, 6))).toBe('road');
      expect(classifyEdge(edge(use, 12))).toBe('road');
    }
  });
  it('a track is a track even in town (density 6 or more)', () => {
    expect(classifyEdge(edge('track', 6))).toBe('track');
    expect(classifyEdge(edge('track', 15))).toBe('track');
  });
  it('an edge without density (absent in the answer) is a trail for a path', () => {
    // ADR 0017, section 3: absent density = 0. The reading of the answer
    // gives the number 0, then the rule classifies it.
    const parsed = parseTraceResponse(
      JSON.stringify({ edges: [{ use: 'path', length: 0.4 }] }),
    );
    if (!parsed.ok) throw new Error('not ok');
    expect(parsed.edges).toEqual([{ use: 'path', density: 0, lengthKm: 0.4 }]);
    expect(classifyEdge(parsed.edges[0] as TerrainEdge)).toBe('trail');
  });
  it('shares: simple case 50 / 25 / 25', () => {
    expect(
      terrainShares(
        [edge('road', 0, 2), edge('track', 0, 1), edge('path', 0, 1)],
        0,
      ),
    ).toEqual([
      { part: 'road', percent: 50 },
      { part: 'track', percent: 25 },
      { part: 'trail', percent: 25 },
    ]);
  });
  it('thirds: 34 / 33 / 33, the tie goes to road then track then trail', () => {
    const shares = terrainShares(
      [edge('road', 0, 1), edge('track', 0, 1), edge('path', 0, 1)],
      0,
    );
    expect(shares?.map((s) => s.percent)).toEqual([34, 33, 33]);
  });
  it('four equal parts with a hand leg: 25 each', () => {
    const shares = terrainShares(
      [edge('road', 0, 1), edge('track', 0, 1), edge('path', 0, 1)],
      1,
    );
    expect(shares?.map((s) => s.percent)).toEqual([25, 25, 25, 25]);
  });
  it('largest remainder: 1/3 + 1/3 + 1/3 of three parts + hand sum to 100', () => {
    expect(roundShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundShares([2, 1])).toEqual([67, 33]);
  });
  it('road, track and trail are always listed, even at 0 %', () => {
    const shares = terrainShares([edge('road', 0, 3)], 0);
    expect(shares).toEqual([
      { part: 'road', percent: 100 },
      { part: 'track', percent: 0 },
      { part: 'trail', percent: 0 },
    ]);
  });
  it('"hand" is listed only with a hand leg', () => {
    const without = terrainShares([edge('road', 0, 1)], 0);
    const withHand = terrainShares([edge('road', 0, 1)], 0.5);
    expect(without?.some((s) => s.part === 'hand')).toBe(false);
    expect(withHand?.find((s) => s.part === 'hand')?.percent).toBe(33);
  });
  it('a hand-only route is 100 % "hand"', () => {
    expect(terrainShares([], 0.6)).toEqual([
      { part: 'road', percent: 0 },
      { part: 'track', percent: 0 },
      { part: 'trail', percent: 0 },
      { part: 'hand', percent: 100 },
    ]);
  });
  it('no edges and no hand length: null (no base)', () => {
    expect(terrainShares([], 0)).toBeNull();
    expect(terrainShares([edge('road', 0, 0)], 0)).toBeNull();
  });
  it('shares are integers that sum to 100 on 2000 random cases (fixed seed)', () => {
    const rand = rng(20261028);
    const uses = ['road', 'track', 'path', 'footway', 'steps', 'service_road'];
    for (let n = 0; n < 2000; n++) {
      const count = 1 + Math.floor(rand() * 12);
      const edges = Array.from({ length: count }, () =>
        edge(
          uses[Math.floor(rand() * uses.length)] as string,
          Math.floor(rand() * 10),
          rand() * 3 + 0.0001,
        ),
      );
      const hand = rand() < 0.4 ? rand() * 2 : 0;
      const shares = terrainShares(edges, hand);
      if (!shares) throw new Error(`null shares at case ${n}`);
      const total = shares.reduce((s, x) => s + x.percent, 0);
      expect(total).toBe(100);
      for (const s of shares) {
        expect(Number.isInteger(s.percent)).toBe(true);
        expect(s.percent).toBeGreaterThanOrEqual(0);
      }
      expect(shares.length).toBe(hand > 0 ? 4 : 3);
    }
  });
  it('each rounded share is within 1 point of the exact share', () => {
    const rand = rng(7);
    for (let n = 0; n < 500; n++) {
      const values = Array.from({ length: 4 }, () => rand() * 10);
      const total = values.reduce((a, b) => a + b, 0);
      const rounded = roundShares(values);
      rounded.forEach((r, i) => {
        expect(
          Math.abs(r - ((values[i] as number) / total) * 100),
        ).toBeLessThan(1);
      });
    }
  });
  it('summarizeInfo: shares in the info include the hand part and the 100 %', () => {
    const info = summarizeInfo([
      pathLeg(
        ok([1, 1]),
        trace([
          ['road', 0, 0.5],
          ['path', 2, 0.3],
          ['track', 0, 0.2],
        ]),
      ),
      handInfo(ok([1, 1]), 1),
    ]);
    if (info.terrain.status !== 'ready') throw new Error('not ready');
    expect(info.terrain.shares).toEqual([
      { part: 'road', percent: 25 },
      { part: 'track', percent: 10 },
      { part: 'trail', percent: 15 },
      { part: 'hand', percent: 50 },
    ]);
  });
  it('terrain segments merge neighbours and scale to the leg length', () => {
    expect(
      terrainSegments(
        [edge('road', 0, 1), edge('service_road', 0, 1), edge('track', 0, 2)],
        400,
        100,
      ),
    ).toEqual([
      { part: 'road', fromM: 100, toM: 300 },
      { part: 'track', fromM: 300, toM: 500 },
    ]);
  });
});

describe('C10 - never crashes, missing data are independent', () => {
  const t = trace([['road', 0, 1]]);
  it('altitudes ok, terrain failed: only the terrain is missing', () => {
    const info = summarizeInfo([pathLeg(ok([100, 120]), failed)]);
    expect(info.altitudes.status).toBe('ready');
    expect(info.terrain).toEqual({ status: 'missing' });
  });
  it('terrain ok, altitudes failed: only the altitudes are missing', () => {
    const info = summarizeInfo([pathLeg(failed, t)]);
    expect(info.altitudes).toEqual({ status: 'missing' });
    expect(info.terrain.status).toBe('ready');
  });
  it('a single null among many altitudes makes everything missing (no partial D+)', () => {
    const h = Array.from({ length: 50 }, (_, i) => i * 10) as (number | null)[];
    h[25] = null;
    expect(summarizeInfo([pathLeg(ok(h), t)]).altitudes).toEqual({
      status: 'missing',
    });
  });
  it('all or nothing across legs: a null in leg 2 hides the D+ of leg 1', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 200]), t),
      pathLeg(ok([200, null]), t),
    ]);
    expect(info.altitudes).toEqual({ status: 'missing' });
  });
  it('a hand leg outside the zone (no altitudes) keeps the terrain', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 110]), t),
      handInfo(failed, 0.5),
    ]);
    expect(info.altitudes.status).toBe('missing');
    if (info.terrain.status !== 'ready') throw new Error('not ready');
    expect(info.terrain.shares.find((s) => s.part === 'hand')?.percent).toBe(
      33,
    );
    expect(info.terrain.segments).toEqual([]);
  });
  it('pending: unfinished requests are "pending", per block', () => {
    const info = summarizeInfo([pathLeg(undefined, undefined)]);
    expect(info.altitudes.status).toBe('pending');
    expect(info.terrain.status).toBe('pending');
    const half = summarizeInfo([pathLeg(ok([1, 2]), undefined)]);
    expect(half.altitudes.status).toBe('ready');
    expect(half.terrain.status).toBe('pending');
  });
  it('a hand leg alone needs no trace: terrain is not pending', () => {
    const info = summarizeInfo([handInfo(ok([1, 2]), 0.2)]);
    expect(info.terrain.status).toBe('ready');
  });
  it('a failed hand leg alone: altitudes missing, terrain still ready', () => {
    const info = summarizeInfo([handInfo(failed, 0.2)]);
    expect(info.altitudes.status).toBe('missing');
    expect(info.terrain.status).toBe('ready');
  });
  it('empty profile of a leg is missing, not an exception', () => {
    expect(summarizeInfo([pathLeg(ok([]), t)]).altitudes.status).toBe(
      'missing',
    );
  });
  it('a trace with no edge on a path leg is missing, not an exception', () => {
    expect(summarizeInfo([pathLeg(ok([1, 2]), trace([]))]).terrain.status).toBe(
      'missing',
    );
  });
  it('does not throw on empty or odd inputs', () => {
    const odd: LegInfo[][] = [
      [],
      [pathLeg(undefined, undefined)],
      [pathLeg(failed, failed)],
      [handInfo(undefined, 0)],
      [handInfo(ok([]), 0)],
      [pathLeg(ok([NaN, NaN]), trace([['road', NaN, NaN]]))],
      [pathLeg(ok([Infinity, -Infinity]), trace([['', -1, -5]]))],
      [pathLeg(ok([0]), trace([['road', 0, 0]]))],
      [handInfo(ok([1, 2]), -3)],
    ];
    for (const legs of odd) {
      expect(() => summarizeInfo(legs)).not.toThrow();
    }
    expect(() =>
      ascentDescent([NaN, 1, undefined as unknown as number]),
    ).not.toThrow();
    expect(() => terrainShares([], NaN)).not.toThrow();
    expect(() => roundShares([])).not.toThrow();
    expect(() => roundShares([0, 0])).not.toThrow();
    expect(() => terrainSegments([], 100, 0)).not.toThrow();
    expect(() => joinProfiles([[]])).not.toThrow();
  });
  it('roundShares gives zeros when the total is zero or empty', () => {
    expect(roundShares([0, 0, 0])).toEqual([0, 0, 0]);
    expect(roundShares([])).toEqual([]);
  });
});

describe('C11 - no difficulty', () => {
  it('the info has no difficulty anywhere, with all kinds of legs', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 120]), trace([['mountain_bike', 1, 1]])),
      handInfo(ok([120, 130]), 0.1),
    ]);
    const text = JSON.stringify(info).toLowerCase();
    expect(text).not.toMatch(/difficult|mtb|scale|grade/);
    expect(Object.keys(info).sort()).toEqual([
      'altitudes',
      'handKm',
      'terrain',
    ]);
  });
});

describe('Zone rectangle check on hand legs (ADR 0017, section 5)', () => {
  const inside = { id: 1, lon: 6.1, lat: 48.6 };
  const inside2 = { id: 2, lon: 6.2, lat: 48.7 };
  const outside = { id: 3, lon: 7.5, lat: 48.6 };
  const handDraft = (a: typeof inside, b: typeof inside): Draft => ({
    points: [a, b],
    modes: ['hand'],
  });
  const only = (d: Draft) => listLegs(d)[0]!;

  it('both ends inside: the straight line [from, to]', () => {
    expect(
      infoShape(only(handDraft(inside, inside2)), undefined, bbox),
    ).toEqual([
      [6.1, 48.6],
      [6.2, 48.7],
    ]);
  });
  it('start outside the zone: null, no call', () => {
    expect(
      infoShape(only(handDraft(outside, inside)), undefined, bbox),
    ).toBeNull();
  });
  it('end outside the zone: null, no call', () => {
    expect(
      infoShape(only(handDraft(inside, outside)), undefined, bbox),
    ).toBeNull();
  });
  it('both ends outside: null', () => {
    expect(
      infoShape(
        only(handDraft(outside, { ...outside, id: 4 })),
        undefined,
        bbox,
      ),
    ).toBeNull();
  });
  it('outside on latitude only, or on the west side, is also null', () => {
    const north = { id: 5, lon: 6.1, lat: 49.5 };
    const west = { id: 6, lon: 5.0, lat: 48.6 };
    expect(
      infoShape(only(handDraft(north, inside)), undefined, bbox),
    ).toBeNull();
    expect(
      infoShape(only(handDraft(inside, west)), undefined, bbox),
    ).toBeNull();
  });
  it('a point exactly on the rectangle border is inside', () => {
    const corner = { id: 7, lon: bbox.lonMin, lat: bbox.latMin };
    const corner2 = { id: 8, lon: bbox.lonMax, lat: bbox.latMax };
    expect(
      infoShape(only(handDraft(corner, corner2)), undefined, bbox),
    ).toEqual([
      [bbox.lonMin, bbox.latMin],
      [bbox.lonMax, bbox.latMax],
    ]);
  });
  it('a calculated leg gives its route shape, or null while unknown', () => {
    const d: Draft = { points: [inside, inside2], modes: ['path'] };
    const shape: [number, number][] = [
      [6.1, 48.6],
      [6.15, 48.65],
      [6.2, 48.7],
    ];
    expect(infoShape(only(d), { shape }, bbox)).toEqual(shape);
    expect(infoShape(only(d), undefined, bbox)).toBeNull();
  });
});

describe('handLengthKm', () => {
  const p = (id: number, lon: number, lat = 48.6) => ({ id, lon, lat });
  it('is 0 without legs and without hand legs', () => {
    expect(handLengthKm([])).toBe(0);
    const d: Draft = { points: [p(1, 6.1), p(2, 6.2)], modes: ['path'] };
    expect(handLengthKm(listLegs(d))).toBe(0);
  });
  it('one degree of latitude is about 111.2 km (great circle, R = 6371 km)', () => {
    // External reference: 2 * pi * 6371 / 360 = 111.195 km per degree.
    const d: Draft = {
      points: [p(1, 6.1, 48), p(2, 6.1, 49)],
      modes: ['hand'],
    };
    expect(handLengthKm(listLegs(d))).toBeCloseTo(111.195, 1);
  });
  it('sums several hand legs and skips the path legs between them', () => {
    const d: Draft = {
      points: [p(1, 6.1, 48), p(2, 6.1, 48.5), p(3, 6.1, 49), p(4, 6.1, 49.5)],
      modes: ['hand', 'path', 'hand'],
    };
    expect(handLengthKm(listLegs(d))).toBeCloseTo(2 * 55.6, 0);
  });
});
