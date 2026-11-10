// Tester's tests for T3, written from the spec (C6, C7, C8, C11, C12) and
// ADR 0020 (sections 3 to 5), not from the code.

import { trackLengthM } from '../gpx/trackLengthM';
import { joinShapes } from '../route-info/heightGroups';
import type { Bbox } from '@/core/zones/catalogue';
import nancy from './fixtures/nancyCircuits.json';
import { legKey } from './reopen';
import type { LonLat } from './savedRoute';
import { traceToDraft } from './traceDraft';

const NANCY: Bbox = {
  lonMin: 5.84,
  latMin: 48.47,
  lonMax: 6.52,
  latMax: 48.92,
};
const WIDE: Bbox = { lonMin: 0, latMin: 40, lonMax: 20, latMax: 55 };
const M_PER_DEG = (6378160 * Math.PI) / 180;
const circuits = nancy.circuits as unknown as {
  loop: boolean;
  ordered_m: number;
  ordered: LonLat[];
}[];
const key = (p: LonLat) => `${p[0]},${p[1]}`;

/** Distance (m) from a point to the nearest vertex-to-vertex segment. */
function distToLineM(line: readonly LonLat[], p: LonLat): number {
  const cos = Math.cos((p[1] * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const ax = (line[i][0] - p[0]) * cos;
    const ay = line[i][1] - p[1];
    const bx = (line[i + 1][0] - p[0]) * cos;
    const by = line[i + 1][1] - p[1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t) * M_PER_DEG);
  }
  return best;
}

function open(
  line: LonLat[],
  loop: boolean,
  position: LonLat | null,
  bbox: Bbox = NANCY,
) {
  const r = traceToDraft(line, { loop, position, zoneVersion: 6, bbox });
  const pts = r.state.draft.points;
  const legs = pts.slice(1).map((b, i) => {
    const a = pts[i];
    const k = legKey({ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat });
    const leg = r.kept.get(k);
    if (!leg) throw new Error('leg missing for ' + k);
    return leg;
  });
  const shape = joinShapes(legs.map((l) => l.shape as [number, number][]));
  return { ...r, pts, legs, shape: shape as LonLat[] };
}

describe.each([0, 1])('circuit de Nancy %i', (idx) => {
  const c = circuits[idx];
  const line = c.ordered;
  const first = line[0];
  const mid = line[Math.floor(line.length / 3)];
  const positions: [string, LonLat][] = [
    ['sur le premier point', first],
    ['pres d un sommet', [mid[0] + 0.00002, mid[1] + 0.00002]],
    ['loin (Paris)', [2.35, 48.85]],
    ['loin (Strasbourg)', [7.75, 48.58]],
  ];

  it.each(positions)('boucle, position %s', (_n, pos) => {
    const r = open(line, true, pos);
    // start = nearest point of the line to the position (check by brute force)
    const cos = Math.cos((pos[1] * Math.PI) / 180);
    const dStart = Math.hypot(
      (r.pts[0].lon - pos[0]) * cos,
      r.pts[0].lat - pos[1],
    );
    const bestVertex = Math.min(
      ...line.map((p) => Math.hypot((p[0] - pos[0]) * cos, p[1] - pos[1])),
    );
    expect(dStart).toBeLessThanOrEqual(bestVertex + 1e-9);
    // no consecutive duplicate in the whole shape
    for (let i = 1; i < r.shape.length; i++) {
      expect(key(r.shape[i])).not.toBe(key(r.shape[i - 1]));
    }
    // loop closes on the start
    expect(r.shape[0]).toEqual(r.shape[r.shape.length - 1]);
    expect(r.pts[0].lon).toBe(r.pts[r.pts.length - 1].lon);
    expect(r.pts[0].lat).toBe(r.pts[r.pts.length - 1].lat);
    // same length (10 m) and same track (1 m)
    expect(Math.abs(trackLengthM(r.shape) - trackLengthM(line))).toBeLessThan(
      10,
    );
    expect(Math.abs(trackLengthM(line) - c.ordered_m)).toBeLessThan(10);
    r.shape.forEach((p) => expect(distToLineM(line, p)).toBeLessThan(1));
    line.forEach((p) => expect(distToLineM(r.shape, p)).toBeLessThan(1));
    // direction kept: original vertices appear in cyclic order
    const idxOf = new Map(line.slice(0, -1).map((p, i) => [key(p), i]));
    const seq = r.shape
      .map((p) => idxOf.get(key(p)))
      .filter((x) => x !== undefined) as number[];
    let descents = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) descents++;
    expect(descents).toBeLessThanOrEqual(1);
    // legs: ok, trace, 10 km/h, sums
    r.legs.forEach((l) => {
      expect(l.trace).toBe(true);
      expect(l.zoneVersion).toBe(6);
      expect(l.durationS).toBeCloseTo((l.distanceKm / 10) * 3600, 3);
    });
    const sumKm = r.legs.reduce((s, l) => s + l.distanceKm, 0);
    expect(Math.abs(sumKm * 1000 - trackLengthM(line))).toBeLessThan(10);
    // equal parts
    const n = Math.min(50, Math.max(1, Math.round(trackLengthM(line) / 1000)));
    expect(r.legs).toHaveLength(n);
    // every id distinct
    expect(new Set(r.pts.map((p) => p.id)).size).toBe(r.pts.length);
  });

  it('boucle sans position : depart au debut', () => {
    const r = open(line, true, null);
    expect([r.pts[0].lon, r.pts[0].lat]).toEqual(first);
  });

  it('aller simple : depart au debut, meme avec une position au milieu', () => {
    const r = open(line, false, mid);
    expect([r.pts[0].lon, r.pts[0].lat]).toEqual(first);
    expect(Math.abs(trackLengthM(r.shape) - trackLengthM(line))).toBeLessThan(
      10,
    );
  });
});

describe('cas limites du decoupage', () => {
  const M = 1 / M_PER_DEG;
  // straight east-west line at lat 48.7 of given length, every 100 m
  const east = (lengthM: number, extra: LonLat[] = []): LonLat[] => {
    const cos = Math.cos((48.7 * Math.PI) / 180);
    const steps = Math.ceil(lengthM / 100);
    const out: LonLat[] = [];
    for (let i = 0; i <= steps; i++) {
      out.push([
        Math.round((6 + (((lengthM * i) / steps) * M) / cos) * 1e6) / 1e6,
        48.7,
      ]);
    }
    return [...out, ...extra];
  };

  it('moins de 500 m : un troncon', () => {
    const r = open(east(400), false, null, WIDE);
    expect(r.legs).toHaveLength(1);
    expect(r.pts).toHaveLength(2);
  });

  it('trace de 50,4 km : 50 troncons de meme longueur', () => {
    const r = open(east(50400), false, null, WIDE);
    expect(r.legs).toHaveLength(50);
    const lens = r.legs.map((l) => l.distanceKm * 1000);
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThan(1);
  });

  it('trace de 100 km : 50 troncons', () => {
    expect(open(east(100000), false, null, WIDE).legs).toHaveLength(50);
  });

  it('1 400 m : 1 troncon ; 1 500 m : 2 troncons', () => {
    expect(open(east(1400), false, null, WIDE).legs).toHaveLength(1);
    expect(open(east(1510), false, null, WIDE).legs).toHaveLength(2);
  });

  it('deux points identiques consecutifs : pas de doublon, longueur gardee', () => {
    const base = east(5000);
    const line: LonLat[] = [
      ...base.slice(0, 20),
      base[19],
      base[19],
      ...base.slice(20),
    ];
    const r = open(line, false, null, WIDE);
    for (let i = 1; i < r.shape.length; i++) {
      expect(key(r.shape[i])).not.toBe(key(r.shape[i - 1]));
    }
    expect(Math.abs(trackLengthM(r.shape) - trackLengthM(base))).toBeLessThan(
      1,
    );
  });

  it('trace de 2 points : un troncon', () => {
    const r = open(
      [
        [6, 48.7],
        [6.2, 48.7],
      ],
      false,
      null,
    );
    expect(r.legs).toHaveLength(1);
  });
});

describe('sortie de zone (C8, ADR 0020 section 5)', () => {
  const inside = (p: LonLat) =>
    p[0] >= NANCY.lonMin &&
    p[0] <= NANCY.lonMax &&
    p[1] >= NANCY.latMin &&
    p[1] <= NANCY.latMax;
  // goes east at lat 48.7 from lon 6.3 to 6.9 (exits at 6.52), then north
  // outside, then comes back west... build a U: out east, up, back west.
  const step = 0.002;
  const line: LonLat[] = [];
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  for (let lon = 6.3; lon <= 6.8; lon += step) line.push([r6(lon), 48.6]);
  for (let lat = 48.6; lat <= 48.8; lat += step) line.push([6.8, r6(lat)]);
  for (let lon = 6.8; lon >= 6.3; lon -= step) line.push([r6(lon), 48.8]);

  it('aucun point intermediaire hors zone, un troncon traverse', () => {
    const r = open(line, false, null);
    const mids = r.pts.slice(1, -1).map((p) => [p.lon, p.lat] as LonLat);
    mids.forEach((p) => expect(inside(p)).toBe(true));
    expect(r.pts.length).toBeGreaterThanOrEqual(2);
    // the leg that crosses the outside holds points outside
    expect(r.legs.some((l) => l.shape.some((p) => !inside(p as LonLat)))).toBe(
      true,
    );
    expect(Math.abs(trackLengthM(r.shape) - trackLengthM(line))).toBeLessThan(
      10,
    );
    // a single leg goes from last point inside before exit to first inside after
    const crossing = r.legs.filter((l) =>
      l.shape.some((p) => !inside(p as LonLat)),
    );
    expect(crossing).toHaveLength(1);
  });

  it('trace entierement hors zone : un seul troncon', () => {
    const far: LonLat[] = [];
    for (let i = 0; i <= 80; i++) far.push([r6(7.5 + i * 0.002), 49.5]);
    const r = open(far, false, null);
    expect(r.pts).toHaveLength(2);
    expect(r.legs).toHaveLength(1);
  });
});

describe('C12 rapidite (indicatif sous Jest, seuil 1 s)', () => {
  it('circuit de 35 km', () => {
    const t0 = performance.now();
    open(circuits[1].ordered, true, [6.04, 48.9]);
    const ms = performance.now() - t0;
    console.log('C12 circuit 35 km (ms):', ms.toFixed(1));
    expect(ms).toBeLessThan(1000);
  });

  it('trace de 10 000 points', () => {
    const line: LonLat[] = [];
    for (let i = 0; i < 10000; i++) {
      line.push([
        Math.round((6 + i * 0.00003) * 1e6) / 1e6,
        Math.round((48.6 + Math.sin(i / 200) * 0.01) * 1e6) / 1e6,
      ]);
    }
    const t0 = performance.now();
    const r = traceToDraft(line, {
      loop: false,
      position: null,
      zoneVersion: 6,
      bbox: NANCY,
    });
    const ms = performance.now() - t0;
    console.log(
      'C12 trace 10000 points (ms):',
      ms.toFixed(1),
      'legs',
      r.kept.size,
    );
    expect(ms).toBeLessThan(1000);
  });
});
