import type { Draft } from '@/core/draft/draft';
import type { LonLat, SavedLeg } from '@/core/routes/savedRoute';
import { trackOfCreated } from '@/core/routes/track';

import {
  angleDiff,
  bearingBetween,
  buildLine,
  distanceM,
  guidedParts,
  normalizeFree,
  pointAt,
  sliceLine,
  sourceOfCreated,
  sourceOfGpx,
} from './trackingLine';

const bbox = { lonMin: 6, latMin: 48, lonMax: 7, latMax: 49 };

// 0.01 degree of latitude: 6 378 160 m x 0.01 x pi / 180 = 1 113.19 m
const north = (lat: number): LonLat => [6.5, lat];

describe('distanceM and bearingBetween', () => {
  it('measures on the sphere of the engine', () => {
    expect(distanceM([6.5, 48], [6.5, 48.01])).toBeCloseTo(1113.19, 1);
    // 0.01 degree of longitude at 48 degrees: 1 113.19 x cos(48 deg) = 744.8 m
    expect(distanceM([6.5, 48], [6.51, 48])).toBeCloseTo(744.8, 0);
  });

  it('gives compass bearings', () => {
    expect(bearingBetween([6.5, 48], [6.5, 48.01])).toBeCloseTo(0, 3);
    expect(bearingBetween([6.5, 48], [6.51, 48])).toBeCloseTo(90, 0);
    expect(bearingBetween([6.5, 48], [6.5, 47.99])).toBeCloseTo(180, 3);
    expect(bearingBetween([6.5, 48], [6.49, 48])).toBeCloseTo(270, 0);
  });

  it('gives the smallest angle between two bearings', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
    expect(angleDiff(90, 90)).toBe(0);
  });
});

describe('buildLine, pointAt, sliceLine', () => {
  const line = buildLine([north(48), north(48.01), north(48.02)]);

  it('cumulates the distances', () => {
    expect(line.lengthM).toBeCloseTo(2226.4, 0);
    expect(line.cumM[1]).toBeCloseTo(1113.2, 0);
    // the local plane is in meters
    expect(line.ys[2]).toBeCloseTo(1113.2, 0);
  });

  it('finds the point at a distance, and stays between the ends', () => {
    expect(pointAt(line, 556.6)[1]).toBeCloseTo(48.005, 4);
    expect(pointAt(line, -5)).toEqual([6.5, 48]);
    expect(pointAt(line, 99_999)).toEqual([6.5, 48.02]);
  });

  it('slices with interpolated ends', () => {
    const part = sliceLine(line, 556.6, 1669.8);
    expect(part).toHaveLength(3);
    expect(part[0]?.[1]).toBeCloseTo(48.005, 4);
    expect(part[1]).toEqual([6.5, 48.01]);
    expect(part[2]?.[1]).toBeCloseTo(48.015, 4);
  });
});

describe('normalizeFree and guidedParts', () => {
  it('sorts, cuts overlaps (the earlier wins) and joins the same reason', () => {
    expect(
      normalizeFree([
        { fromM: 500, toM: 900, reason: 'outOfZone' },
        { fromM: 100, toM: 600, reason: 'hand' },
        { fromM: 900, toM: 1000, reason: 'outOfZone' },
        { fromM: 200, toM: 300, reason: 'hand' },
      ]),
    ).toEqual([
      { fromM: 100, toM: 600, reason: 'hand' },
      { fromM: 600, toM: 1000, reason: 'outOfZone' },
    ]);
  });

  it('gives the stretches between the free ones', () => {
    const line = buildLine([north(48), north(48.01)]);
    expect(guidedParts(line, [])).toEqual([{ fromM: 0, toM: line.lengthM }]);
    expect(
      guidedParts(line, [
        { fromM: 0, toM: 100, reason: 'hand' },
        { fromM: 400, toM: 500, reason: 'hand' },
      ]),
    ).toEqual([
      { fromM: 100, toM: 400 },
      { fromM: 500, toM: line.lengthM },
    ]);
    expect(
      guidedParts(line, [{ fromM: 0, toM: line.lengthM, reason: 'hand' }]),
    ).toEqual([]);
  });
});

describe('sourceOfCreated', () => {
  // Points 1 to 4. Legs: path 1-2, hand 2-3 (placed points), path 3-4.
  const draft: Draft = {
    points: [
      { id: 1, lon: 6.5, lat: 48 },
      { id: 2, lon: 6.5, lat: 48.01 },
      { id: 3, lon: 6.5, lat: 48.02 },
      { id: 4, lon: 6.5, lat: 48.03 },
    ],
    modes: ['path', 'hand', 'path'],
  };
  const path = (shape: LonLat[]): SavedLeg => ({
    mode: 'path',
    zoneVersion: 1,
    distanceKm: 1,
    durationS: 1,
    shape,
  });
  const legs: SavedLeg[] = [
    path([north(48), north(48.005), north(48.0101)]),
    { mode: 'hand' },
    path([north(48.0199), north(48.03)]),
  ];

  it('has the same line as trackOfCreated, with the hand leg free', () => {
    const { line, free } = sourceOfCreated(draft, legs, bbox);
    expect(line.points).toEqual(trackOfCreated(draft, legs));
    // the hand leg joins the end of the first shape to the start of the third
    expect(free).toHaveLength(1);
    expect(free[0]?.reason).toBe('hand');
    expect(free[0]?.fromM).toBeCloseTo(distanceM(north(48), north(48.0101)), 1);
    expect(free[0]?.toM).toBeCloseTo(distanceM(north(48), north(48.0199)), 1);
  });

  it('makes free a leg with a point outside the rectangle of the zone', () => {
    const outside: SavedLeg[] = [
      path([north(48), north(48.005), north(48.0101)]),
      { mode: 'hand' },
      path([north(48.0199), north(49.5)]),
    ];
    const { free, line } = sourceOfCreated(draft, outside, bbox);
    expect(free.map((f) => f.reason)).toEqual(['hand', 'outOfZone']);
    expect(free[1]?.toM).toBeCloseTo(line.lengthM, 1);
    // the hand leg keeps its stretch
    expect(free[1]?.fromM).toBeCloseTo(free[0]?.toM ?? 0, 1);
  });

  it('makes the whole line out of the zone without a zone in service', () => {
    const { free, line } = sourceOfCreated(draft, legs, null);
    expect(free).toEqual([
      { fromM: 0, toM: line.lengthM, reason: 'outOfZone' },
    ]);
  });

  it('handles hand legs at the ends and a hand leg between hand legs', () => {
    const hand: Draft = {
      points: [
        { id: 1, lon: 6.5, lat: 48 },
        { id: 2, lon: 6.5, lat: 48.01 },
        { id: 3, lon: 6.5, lat: 48.02 },
      ],
      modes: ['hand', 'hand'],
    };
    const { line, free } = sourceOfCreated(
      hand,
      [{ mode: 'hand' }, { mode: 'hand' }],
      bbox,
    );
    expect(line.points).toHaveLength(3);
    expect(free).toEqual([{ fromM: 0, toM: line.lengthM, reason: 'hand' }]);
  });
});

describe('sourceOfGpx', () => {
  it('keeps the track and marks the stretch outside the rectangle', () => {
    const track: LonLat[] = [
      north(48.1),
      north(48.5),
      north(48.9),
      north(49.2),
      north(49.3),
      north(48.9),
    ];
    const { line, free } = sourceOfGpx(track, bbox);
    expect(line.points).toEqual(track);
    // the segments 48.9 -> 49.2 -> 49.3 -> 48.9 touch the outside
    expect(free).toEqual([
      {
        fromM: line.cumM[2],
        toM: line.lengthM,
        reason: 'outOfZone',
      },
    ]);
  });

  it('has no free stretch inside the zone, all of it without a zone', () => {
    const track = [north(48.1), north(48.2)];
    expect(sourceOfGpx(track, bbox).free).toEqual([]);
    const none = sourceOfGpx(track, null);
    expect(none.free).toEqual([
      { fromM: 0, toM: none.line.lengthM, reason: 'outOfZone' },
    ]);
  });

  it('thins a track of more than 14 000 points', () => {
    const track: LonLat[] = [];
    for (let i = 0; i < 20_000; i++) track.push([6.5, 48 + i * 0.00001]);
    const { line } = sourceOfGpx(track, bbox);
    expect(line.points.length).toBeLessThanOrEqual(14_100);
    expect(line.points[0]).toEqual(track[0]);
    expect(line.points[line.points.length - 1]).toEqual(track[19_999]);
  });
});
