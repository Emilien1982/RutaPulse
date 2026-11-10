import { decodePolyline6 } from '@/core/routing/routeResponse';

import type { Fix } from './placement';
import {
  addRideFix,
  buildRideHeightRequest,
  KEEP_STEP_M,
  rideAscentM,
  rideDurationS,
  startRide,
} from './ride';
import { distanceM } from './trackingLine';
import { rideAlong, toLonLat } from './testing/fabricate';

const bbox = { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49 };

function ride(fixes: Fix[]) {
  return fixes.reduce(addRideFix, startRide(fixes[0]?.at ?? 0));
}

describe('addRideFix', () => {
  it('keeps the first position and then one every 10 m or more', () => {
    // 5 m/s: a position every 5 m. About half of them are kept.
    const fixes = rideAlong(
      [
        [0, 0],
        [1000, 0],
      ],
      { speed: 5 },
    );
    const done = ride(fixes);
    expect(done.kept[0]).toEqual([fixes[0]?.lon, fixes[0]?.lat]);
    expect(done.kept.length).toBeGreaterThan(80);
    expect(done.kept.length).toBeLessThan(fixes.length);
    let sum = 0;
    for (let i = 1; i < done.kept.length; i++) {
      const step = distanceM(
        done.kept[i - 1] as number[],
        done.kept[i] as number[],
      );
      expect(step).toBeGreaterThanOrEqual(KEEP_STEP_M - 1e-6);
      sum += step;
    }
    expect(done.distanceM).toBeCloseTo(sum, 6);
    expect(done.distanceM).toBeGreaterThan(950);
    expect(done.distanceM).toBeLessThanOrEqual(1000);
  });

  it('adds nothing for the noise at a standstill', () => {
    const still: Fix[] = Array.from({ length: 200 }, (_, k) => {
      const [lon, lat] = toLonLat([((k * 7) % 9) - 4, ((k * 5) % 7) - 3]);
      return { lon, lat, accuracy: 5, at: k * 1000 };
    });
    const done = ride(still);
    expect(done.kept.length).toBeLessThan(5);
    expect(done.distanceM).toBeLessThan(40);
  });

  it('ignores a position of more than 50 m of precision', () => {
    const fixes = rideAlong(
      [
        [0, 0],
        [100, 0],
      ],
      { speed: 20 },
    );
    const bad = fixes.map((f, k) => (k === 2 ? { ...f, accuracy: 51 } : f));
    expect(ride(bad).kept).toHaveLength(ride(fixes).kept.length - 1);
  });

  it('counts the jump after a pause in a straight line', () => {
    const before = rideAlong(
      [
        [0, 0],
        [100, 0],
      ],
      { speed: 10 },
    );
    const after = rideAlong(
      [
        [600, 0],
        [700, 0],
      ],
      {
        speed: 10,
        startAt: 5_000_000,
      },
    );
    const done = ride([...before, ...after]);
    // 100 m, then 500 m between the last position before and the first after, then 100 m
    expect(done.distanceM).toBeCloseTo(700, 0);
    const jumps = done.kept
      .slice(1)
      .map((p, i) => distanceM(done.kept[i] as number[], p));
    expect(jumps.filter((d) => d > 400)).toHaveLength(1);
    expect(Math.max(...jumps)).toBeCloseTo(500, 0);
  });
});

describe('rideDurationS', () => {
  it('runs from the start to the end by the clock, pauses included', () => {
    const started = startRide(1_000_000);
    expect(rideDurationS(started, 1_000_000 + 3_725_400)).toBe(3725);
    expect(rideDurationS(started, 999_000)).toBe(0);
  });
});

describe('buildRideHeightRequest', () => {
  const kept = ride(
    rideAlong([
      [0, 0],
      [600, 0],
    ]),
  ).kept;

  it('asks one altitude every 30 m of the positions kept', () => {
    const text = buildRideHeightRequest({ ...startRide(0), kept }, bbox);
    const body = JSON.parse(text as string);
    expect(body.resample_distance).toBe(30);
    expect(body.range).toBe(true);
    expect(decodePolyline6(body.encoded_polyline)).toHaveLength(kept.length);
  });

  it('thins a ride of more than 14 000 positions', () => {
    const many = Array.from({ length: 20_000 }, (_, i): [number, number] => [
      6 + i * 1e-6,
      48.5,
    ]);
    const text = buildRideHeightRequest({ ...startRide(0), kept: many }, bbox);
    const count = decodePolyline6(
      JSON.parse(text as string).encoded_polyline,
    ).length;
    expect(count).toBeLessThanOrEqual(14_001);
    expect(count).toBeGreaterThan(5_000);
  });

  it('gives null without a zone, outside the zone, or with less than two positions', () => {
    expect(buildRideHeightRequest({ ...startRide(0), kept }, null)).toBeNull();
    expect(
      buildRideHeightRequest(
        { ...startRide(0), kept: [...kept, [9, 48.5]] },
        bbox,
      ),
    ).toBeNull();
    expect(
      buildRideHeightRequest(
        { ...startRide(0), kept: [kept[0] as [number, number]] },
        bbox,
      ),
    ).toBeNull();
  });
});

describe('rideAscentM', () => {
  it('counts the ascent of the profile with the 5 m threshold', () => {
    const profile = [100, 102, 110, 108, 104, 120].map(
      (h, i): [number, number | null] => [i * 30, h],
    );
    // 100 -> 110 (+10), 104 -> 120 (+16)
    expect(rideAscentM({ ok: true, profile })).toBe(26);
  });

  it('gives null on a failure or a missing altitude', () => {
    expect(rideAscentM({ ok: false, error: 'failed' })).toBeNull();
    expect(
      rideAscentM({
        ok: true,
        profile: [
          [0, 100],
          [30, null],
        ],
      }),
    ).toBeNull();
  });
});
