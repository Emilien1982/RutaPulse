import { findProblem } from '@/core/draft/problem';
import { isInsideBbox } from '@/core/zones/activeZone';
import type { Bbox } from '@/core/zones/catalogue';

import { trackLengthM } from '../gpx/trackLengthM';
import nancy from './fixtures/nancyCircuits.json';
import { legKey } from './reopen';
import type { LonLat } from './savedRoute';
import {
  cutTrace,
  legCount,
  nearestOnLine,
  rotateLoop,
  traceToDraft,
} from './traceDraft';

const WIDE: Bbox = { lonMin: 4, latMin: 47, lonMax: 8, latMax: 50 };
const NANCY: Bbox = {
  lonMin: 5.84,
  latMin: 48.47,
  lonMax: 6.52,
  latMax: 48.92,
};
const M_PER_DEG = (6378160 * Math.PI) / 180;

/** A line along a diagonal, a point every ~100 m, 6 decimals. */
function diagonal(lengthM: number, from: LonLat = [6, 48.5]): LonLat[] {
  const steps = Math.max(1, Math.round(lengthM / 100));
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  const build = (len: number): LonLat[] => {
    const dLat = len / M_PER_DEG / Math.SQRT2;
    const dLon = dLat / Math.cos((from[1] * Math.PI) / 180);
    return Array.from({ length: steps + 1 }, (_, i) => [
      r6(from[0] + (dLon * i) / steps),
      r6(from[1] + (dLat * i) / steps),
    ]);
  };
  // One correction so that the length on the sphere is lengthM (+1 m, so
  // that rounding cannot fall under a threshold such as 1 500 m).
  const first = build(lengthM);
  return build(((lengthM + 1) * lengthM) / trackLengthM(first));
}

/** Distance (m) from a point to a line, in a local plane. */
function distToLineM(line: readonly LonLat[], p: LonLat): number {
  const cos = Math.cos((p[1] * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const ax = (line[i][0] - p[0]) * cos;
    const ay = line[i][1] - p[1];
    const dx = (line[i + 1][0] - line[i][0]) * cos;
    const dy = line[i + 1][1] - line[i][1];
    const len2 = dx * dx + dy * dy;
    const t =
      len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy) * M_PER_DEG);
  }
  return best;
}

const lengths = (legs: LonLat[][]) => legs.map((l) => trackLengthM(l));
const joined = (legs: LonLat[][]) => {
  const out: LonLat[] = [];
  legs.forEach((leg, i) => out.push(...leg.slice(i === 0 ? 0 : 1)));
  return out;
};

describe('equal parts (ADR 0020, section 3)', () => {
  it.each([
    [1400, 1],
    [1500, 2],
    [35_000, 35],
    [50_000, 50],
    [100_000, 50],
  ])('a trace of %i m is cut in %i legs of the same length', (length, n) => {
    const line = diagonal(length);
    const cut = cutTrace(line, WIDE);
    expect(cut.legs).toHaveLength(n);
    expect(cut.points).toHaveLength(n + 1);
    const each = lengths(cut.legs);
    const total = trackLengthM(line);
    each.forEach((m) => expect(Math.abs(m - total / n)).toBeLessThan(1));
  });

  it('legCount is clamped to 1..50', () => {
    expect(legCount(0)).toBe(1);
    expect(legCount(499)).toBe(1);
    expect(legCount(10_000_000)).toBe(50);
  });

  it('the points are at 6 decimals, on the trace, and shared by two legs', () => {
    const line = diagonal(12_345);
    const { points, legs } = cutTrace(line, WIDE);
    points.forEach((p) => {
      expect(Math.round(p[0] * 1e6) / 1e6).toBe(p[0]);
      expect(Math.round(p[1] * 1e6) / 1e6).toBe(p[1]);
      expect(distToLineM(line, p)).toBeLessThanOrEqual(0.11);
    });
    legs.forEach((leg, i) => {
      expect(leg[0]).toEqual(points[i]);
      expect(leg[leg.length - 1]).toEqual(points[i + 1]);
    });
    expect(points[0]).toEqual(line[0]);
    expect(points[points.length - 1]).toEqual(line[line.length - 1]);
  });
});

describe('fidelity on the two circuits of Nancy (C7)', () => {
  it('has the two circuits, with their attribution', () => {
    expect(nancy.attribution).toBe('© OpenStreetMap contributors, ODbL');
    expect(nancy.circuits).toHaveLength(2);
  });

  describe.each(nancy.circuits.map((c) => [c.osm_id, c] as const))(
    'circuit %i',
    (_id, circuit) => {
      const line = circuit.ordered as LonLat[];
      const total = trackLengthM(line);

      it('the sphere length is the one of the file (10 m)', () => {
        expect(Math.abs(total - circuit.ordered_m)).toBeLessThan(10);
      });

      it('legs put end to end are the trace (1 m), length within 10 m', () => {
        const { state, kept } = traceToDraft(line, {
          loop: false,
          zoneVersion: 6,
          bbox: NANCY,
        });
        const { points } = state.draft;
        const legs = points.slice(1).map((p, i) => {
          const leg = kept.get(legKey(points[i], p));
          return leg!.shape as LonLat[];
        });
        const all = joined(legs);
        // Every vertex of the trace is kept, in order.
        let at = 0;
        for (const v of line) {
          const found = all.findIndex(
            (p, i) => i >= at && p[0] === v[0] && p[1] === v[1],
          );
          expect(found).toBeGreaterThanOrEqual(at);
          at = found;
        }
        // No other point is farther than 1 m from the trace.
        all.forEach((p) => expect(distToLineM(line, p)).toBeLessThan(1));
        const sumM = [...kept.values()].reduce(
          (s, l) => s + l.distanceKm * 1000,
          0,
        );
        expect(Math.abs(sumM - total)).toBeLessThan(10);
        expect(Math.abs(sumM - circuit.ordered_m)).toBeLessThan(10);
        // About one point per kilometre.
        expect(points.length - 1).toBe(Math.round(total / 1000));
      });

      it('rotated from a position: same length, same vertices, 1 m', () => {
        const position: LonLat = [line[300][0] + 0.001, line[300][1] + 0.0004];
        const { state, kept } = traceToDraft(line, {
          loop: true,
          position,
          zoneVersion: 6,
          bbox: NANCY,
        });
        const { points } = state.draft;
        const legs = points.slice(1).map((p, i) => {
          return kept.get(legKey(points[i], p))!.shape as LonLat[];
        });
        const all = joined(legs);
        const sumM = [...kept.values()].reduce(
          (s, l) => s + l.distanceKm * 1000,
          0,
        );
        expect(Math.abs(sumM - total)).toBeLessThan(10);
        all.forEach((p) => expect(distToLineM(line, p)).toBeLessThan(1));
        // No leg of zero length, no point repeated in a row.
        all.forEach((p, i) => {
          if (i > 0) expect(p).not.toEqual(all[i - 1]);
        });
        expect(points[0].lon).toBe(points[points.length - 1].lon);
        expect(points[0].lat).toBe(points[points.length - 1].lat);
        expect(points[0].id).not.toBe(points[points.length - 1].id);
      });
    },
  );
});

describe('rotateLoop', () => {
  // A closed square: 4 sides, first point = last point.
  const square: LonLat[] = [
    [6, 48.5],
    [6.01, 48.5],
    [6.01, 48.51],
    [6, 48.51],
    [6, 48.5],
  ];
  const noRepeat = (line: LonLat[]) =>
    line.forEach((p, i) => {
      if (i > 0) expect(p).not.toEqual(line[i - 1]);
    });

  it('start in the middle of a segment: same length, same vertices', () => {
    const near = nearestOnLine(square, [6.005, 48.4999]);
    expect(near.point).toEqual([6.005, 48.5]);
    const out = rotateLoop(square, near);
    expect(out).toEqual([
      [6.005, 48.5],
      [6.01, 48.5],
      [6.01, 48.51],
      [6, 48.51],
      [6, 48.5],
      [6.005, 48.5],
    ]);
    expect(Math.abs(trackLengthM(out) - trackLengthM(square))).toBeLessThan(
      0.01,
    );
    noRepeat(out);
  });

  it('start right on a vertex: that vertex is not repeated', () => {
    const near = nearestOnLine(square, [6.0101, 48.5101]);
    expect(near.point).toEqual([6.01, 48.51]);
    const out = rotateLoop(square, near);
    expect(out).toEqual([
      [6.01, 48.51],
      [6, 48.51],
      [6, 48.5],
      [6.01, 48.5],
      [6.01, 48.51],
    ]);
    expect(trackLengthM(out)).toBeCloseTo(trackLengthM(square), 6);
    noRepeat(out);
  });

  it('start on the junction point: same line, junction once', () => {
    const out = rotateLoop(square, nearestOnLine(square, [5.999, 48.499]));
    expect(out).toEqual(square);
    noRepeat(out);
  });

  it('start on the last vertex before the junction', () => {
    const out = rotateLoop(square, { point: [6, 48.51], segment: 3 });
    expect(out).toEqual([
      [6, 48.51],
      [6, 48.5],
      [6.01, 48.5],
      [6.01, 48.51],
      [6, 48.51],
    ]);
  });

  it('the nearest point has no distance limit', () => {
    expect(nearestOnLine(square, [7, 49]).point).toEqual([6.01, 48.51]);
  });
});

describe('where the draft starts', () => {
  const loopLine = (() => {
    const sq: LonLat[] = [
      [6, 48.5],
      [6.03, 48.5],
      [6.03, 48.53],
      [6, 48.53],
      [6, 48.5],
    ];
    return sq;
  })();

  it('unknown position: a loop starts at the beginning of the line', () => {
    const { state } = traceToDraft(loopLine, {
      loop: true,
      position: null,
      zoneVersion: 6,
      bbox: WIDE,
    });
    expect(state.draft.points[0]).toMatchObject({ lon: 6, lat: 48.5 });
  });

  it('a loop starts at the point nearest to the position', () => {
    const { state } = traceToDraft(loopLine, {
      loop: true,
      position: [6.015, 48.54],
      zoneVersion: 6,
      bbox: WIDE,
    });
    expect(state.draft.points[0]).toMatchObject({ lon: 6.015, lat: 48.53 });
    const pts = state.draft.points;
    expect(pts[pts.length - 1]).toMatchObject({ lon: 6.015, lat: 48.53 });
  });

  it('one-way: starts at the beginning even with a position', () => {
    const { state } = traceToDraft(loopLine.slice(0, 4), {
      loop: false,
      position: [6.03, 48.53],
      zoneVersion: 6,
      bbox: WIDE,
    });
    expect(state.draft.points[0]).toMatchObject({ lon: 6, lat: 48.5 });
  });

  it('a GPX that comes back to its start is not rotated', () => {
    const { state } = traceToDraft(loopLine, {
      loop: false,
      position: [6.03, 48.53],
      zoneVersion: 6,
      bbox: WIDE,
    });
    expect(state.draft.points[0]).toMatchObject({ lon: 6, lat: 48.5 });
  });
});

describe('the starting state and the kept legs', () => {
  it('has an empty history, ids from 1, path legs, trace legs at 10 km/h', () => {
    const line = diagonal(5000);
    const { state, kept } = traceToDraft(line, {
      loop: false,
      zoneVersion: 6,
      bbox: WIDE,
    });
    expect(state.past).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.draft.points.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(state.nextId).toBe(7);
    expect(state.draft.modes).toEqual(Array(5).fill('path'));
    expect(kept.size).toBe(5);
    kept.forEach((leg) => {
      expect(leg).toMatchObject({ ok: true, zoneVersion: 6, trace: true });
      expect(leg.durationS).toBeCloseTo((leg.distanceKm / 10) * 3600, 9);
    });
  });

  it('a trace of 2 points is one leg, the straight line, even 5 km long', () => {
    const line: LonLat[] = [
      [6, 48.5],
      [6.05, 48.53],
    ];
    expect(trackLengthM(line)).toBeGreaterThan(4000);
    const { state, kept } = traceToDraft(line, {
      loop: false,
      zoneVersion: 6,
      bbox: WIDE,
    });
    expect(state.draft.points).toHaveLength(2);
    expect(kept.size).toBe(1);
    expect([...kept.values()][0].shape).toEqual(line);
  });

  it('the durations of the legs add up to the duration of the trace', () => {
    const line = diagonal(12_345);
    const { kept } = traceToDraft(line, {
      loop: false,
      zoneVersion: 6,
      bbox: WIDE,
    });
    const sum = [...kept.values()].reduce((s, l) => s + l.durationS, 0);
    expect(sum).toBeCloseTo((trackLengthM(line) / 10_000) * 3600, 1);
  });

  it.each([
    [10_000, 40_000],
    [150_000, 60_000],
  ])(
    'a GPX of %i points: 50 legs, in order, none over 16 000 points',
    (count, length) => {
      // Straight line of `count` points, a point every few metres.
      const line: LonLat[] = Array.from({ length: count }, (_, i) => [
        Math.round((6 + (0.5 * i) / count) * 1e6) / 1e6,
        Math.round((48.5 + (0.3 * i) / count) * 1e6) / 1e6,
      ]);
      expect(trackLengthM(line)).toBeGreaterThan(length / 2);
      const { kept, state } = traceToDraft(line, {
        loop: false,
        zoneVersion: 6,
        bbox: WIDE,
      });
      const dp = state.draft.points;
      expect(dp.length - 1).toBe(50);
      const legs = dp
        .slice(1)
        .map((p, i) => kept.get(legKey(dp[i], p))!.shape as LonLat[]);
      legs.forEach((leg) => expect(leg.length).toBeLessThanOrEqual(16_000));
      const all = joined(legs);
      // Every point of the trace is there, in order.
      let at = 0;
      for (const v of line) {
        while (
          at < all.length &&
          (all[at][0] !== v[0] || all[at][1] !== v[1])
        ) {
          at++;
        }
        expect(at).toBeLessThan(all.length);
      }
      expect(all[0]).toEqual(line[0]);
      expect(all[all.length - 1]).toEqual(line[count - 1]);
    },
  );

  it('out and back on the same path: two keys per pair, none lost', () => {
    const way = diagonal(6000);
    const line = [...way, ...[...way].reverse().slice(1)];
    const { state, kept } = traceToDraft(line, {
      loop: false,
      zoneVersion: 6,
      bbox: WIDE,
    });
    expect(kept.size).toBe(state.draft.points.length - 1);
  });
});

describe('a trace that leaves the zone (ADR 0020, section 5)', () => {
  const zone: Bbox = { lonMin: 5.8, latMin: 48.6, lonMax: 6.1, latMax: 48.8 };
  const inside = (p: LonLat) => isInsideBbox(zone, p[0], p[1]);
  const run = (line: LonLat[]) => {
    const { state, kept } = traceToDraft(line, {
      loop: false,
      zoneVersion: 6,
      bbox: zone,
    });
    const dp = state.draft.points;
    const legs = dp
      .slice(1)
      .map((p, i) => kept.get(legKey(dp[i], p))!.shape as LonLat[]);
    const points = dp.map((p): LonLat => [p.lon, p.lat]);
    return { state, points, legs };
  };
  const line = (...corners: LonLat[]): LonLat[] =>
    corners.slice(1).reduce<LonLat[]>(
      (acc, c, i) => {
        const a = corners[i];
        const steps = Math.round(trackLengthM([a, c]) / 100);
        for (let s = 1; s <= steps; s++) {
          acc.push([
            Math.round((a[0] + ((c[0] - a[0]) * s) / steps) * 1e6) / 1e6,
            Math.round((a[1] + ((c[1] - a[1]) * s) / steps) * 1e6) / 1e6,
          ]);
        }
        return acc;
      },
      [corners[0]],
    );

  it('goes out then comes back: no point outside, one leg across', () => {
    const { state, points, legs } = run(
      line([5.9, 48.7], [6.2, 48.7], [6.2, 48.75], [5.9, 48.75]),
    );
    points.forEach((p) => expect(inside(p)).toBe(true));
    const outsideLegs = legs.filter((l) => l.some((p) => !inside(p)));
    expect(outsideLegs).toHaveLength(1);
    const across = outsideLegs[0];
    expect(inside(across[0])).toBe(true);
    expect(inside(across[across.length - 1])).toBe(true);
    // The leg across is longer than the others: it joins several parts.
    expect(trackLengthM(across)).toBeGreaterThan(1.5 * 1500);
    // Opening the draft is not a problem (no error, no target).
    expect(findProblem(state.draft, [], null, zone)).toBeUndefined();
  });

  it('starts outside: the start is posted, one leg up to the first point inside', () => {
    const { points, legs } = run(
      line([5.7, 48.7], [5.95, 48.7], [5.95, 48.75]),
    );
    expect(inside(points[0])).toBe(false);
    expect(points[0]).toEqual([5.7, 48.7]);
    points.slice(1).forEach((p) => expect(inside(p)).toBe(true));
    expect(legs.filter((l) => l.some((p) => !inside(p)))).toHaveLength(1);
    expect(legs[0].some((p) => !inside(p))).toBe(true);
  });

  it('ends outside: the end is posted, one leg from the last point inside', () => {
    const { points, legs, state } = run(
      line([5.9, 48.7], [6.05, 48.7], [6.3, 48.7]),
    );
    expect(points[points.length - 1]).toEqual([6.3, 48.7]);
    points.slice(0, -1).forEach((p) => expect(inside(p)).toBe(true));
    expect(legs.filter((l) => l.some((p) => !inside(p)))).toHaveLength(1);
    expect(legs[legs.length - 1].some((p) => !inside(p))).toBe(true);
    expect(findProblem(state.draft, [], null, zone)).toBeUndefined();
  });

  it('entirely outside: the two ends and one kept leg', () => {
    const { points, legs } = run(line([6.2, 48.7], [6.5, 48.7]));
    expect(points).toHaveLength(2);
    expect(legs).toHaveLength(1);
  });
});
