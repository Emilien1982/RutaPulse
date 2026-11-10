import { decodePolyline6 } from '@/core/routing/routeResponse';
import type { LonLat } from '@/core/routes/savedRoute';

import line3 from './fixtures/line-3.json';
import {
  cameraBearing,
  hasArrived,
  initialPlacement,
  placeFix,
  type Fix,
  type Placement,
} from './placement';
import { remainingM } from './remaining';
import {
  dense,
  figureEight,
  lineOf,
  loop,
  outAndBack,
  pathLength,
  pointAlong,
  rideAlong,
  switchbacks,
  toLonLat,
  type XY,
} from './testing/fabricate';
import { buildLine, type TrackingLine } from './trackingLine';

/** The line of a fabricated path, with a point every 10 m like a real track. */
function lineOfPath(path: XY[]): TrackingLine {
  return buildLine(lineOf(dense(path)));
}

/** All the placements of a ride, one per fix. */
function place(line: TrackingLine, fixes: Fix[]): Placement[] {
  let placement = initialPlacement();
  return fixes.map((fix) => {
    placement = placeFix(line, placement, fix);
    return placement;
  });
}

/** Largest error (m) of the distance left, against the true distance left. */
function worstRemainingError(
  line: TrackingLine,
  placements: Placement[],
  fromM: number,
  speed: number,
): number {
  let worst = 0;
  placements.forEach((placement, k) => {
    if (placement.phase === 'approach') return;
    const truth = line.lengthM - (fromM + k * speed);
    worst = Math.max(worst, Math.abs(remainingM(line, placement) - truth));
  });
  return worst;
}

/** The largest step back and forward of the progress between two fixes. */
function steps(placements: Placement[]): { back: number; ahead: number } {
  let back = 0;
  let ahead = 0;
  for (let k = 1; k < placements.length; k++) {
    const d =
      (placements[k] as Placement).progressM -
      (placements[k - 1] as Placement).progressM;
    back = Math.min(back, d);
    ahead = Math.max(ahead, d);
  }
  return { back, ahead };
}

const fixAt = (xy: XY, k: number): Fix => {
  const [lon, lat] = toLonLat(xy);
  return { lon, lat, accuracy: 5, at: 1_700_000_000_000 + k * 1000 };
};

describe('C3: distance left, within 20 m, on fabricated traces at 5 m/s', () => {
  it('straight line of 2 km, GPS error of 8 m', () => {
    const path: XY[] = [
      [0, 0],
      [2000, 0],
    ];
    const line = lineOfPath(path);
    const placements = place(line, rideAlong(path, { noiseM: 8, seed: 3 }));
    expect(placements).toHaveLength(401);
    expect(placements.every((p) => p.phase === 'onTrack')).toBe(true);
    expect(worstRemainingError(line, placements, 0, 5)).toBeLessThan(20);
  });

  it('a loop that ends at its start does not jump to the end', () => {
    const path = loop(300);
    const line = lineOfPath(path);
    const fixes = rideAlong(path, { noiseM: 8, seed: 4 });
    const placements = place(line, fixes);
    expect(placements.every((p) => p.phase === 'onTrack')).toBe(true);
    // the first fix is at the start and the start comes first, not the end
    expect((placements[0] as Placement).progressM).toBeLessThan(20);
    expect(worstRemainingError(line, placements, 0, 5)).toBeLessThan(20);
    expect(steps(placements).back).toBeGreaterThan(-25);
    expect(steps(placements).ahead).toBeLessThan(35);
  });

  it('an out-and-back on the same path follows the way the rider goes', () => {
    const path = outAndBack(1000);
    const line = lineOfPath(path);
    const placements = place(line, rideAlong(path, { noiseM: 8, seed: 5 }));
    expect(placements.every((p) => p.phase === 'onTrack')).toBe(true);
    expect(worstRemainingError(line, placements, 0, 5)).toBeLessThan(20);
    expect(steps(placements).back).toBeGreaterThan(-25);
    expect(steps(placements).ahead).toBeLessThan(35);
  });

  it('a figure eight, where the two passages cross', () => {
    const path = figureEight(150);
    const line = lineOfPath(path);
    const placements = place(line, rideAlong(path, { noiseM: 8, seed: 6 }));
    expect(placements.every((p) => p.phase === 'onTrack')).toBe(true);
    expect(worstRemainingError(line, placements, 0, 5)).toBeLessThan(20);
    expect(steps(placements).back).toBeGreaterThan(-25);
    expect(steps(placements).ahead).toBeLessThan(35);
  });

  it('switchbacks 20 m apart (two passages within 30 m)', () => {
    const path = switchbacks(300, 20, 8);
    const line = lineOfPath(path);
    const placements = place(line, rideAlong(path, { noiseM: 6, seed: 7 }));
    expect(placements.every((p) => p.phase === 'onTrack')).toBe(true);
    expect(worstRemainingError(line, placements, 0, 5)).toBeLessThan(20);
    expect(steps(placements).back).toBeGreaterThan(-25);
    expect(steps(placements).ahead).toBeLessThan(35);
  });

  it('a rider who goes back (U-turn on the track) is followed backwards', () => {
    const line = lineOfPath([
      [0, 0],
      [2000, 0],
    ]);
    const there = rideAlong(
      [
        [0, 0],
        [1000, 0],
      ],
      { speed: 5 },
    );
    const back = rideAlong(
      [
        [1000, 0],
        [600, 0],
      ],
      {
        speed: 5,
        startAt: 1_700_000_000_000 + there.length * 1000,
      },
    );
    const placements = place(line, [...there, ...back]);
    const last = placements[placements.length - 1] as Placement;
    expect(last.progressM).toBeCloseTo(600, -1);
    expect(remainingM(line, last)).toBeCloseTo(1400, -1);
  });

  it('ignores a position of more than 50 m of precision', () => {
    const line = lineOfPath([
      [0, 0],
      [2000, 0],
    ]);
    const first = placeFix(line, initialPlacement(), fixAt([100, 0], 0));
    const bad = { ...fixAt([108, 0], 1), accuracy: 60 };
    expect(placeFix(line, first, bad)).toBe(first);
    const ok = placeFix(line, first, { ...bad, accuracy: 50 });
    expect(ok.progressM).toBeCloseTo(108, 0);
  });
});

describe('C5: off the track and back', () => {
  const path: XY[] = [
    [0, 0],
    [2000, 0],
  ];
  const line = lineOfPath(path);
  // along the track to 800 m, 80 m north (16 s), 200 m parallel (40 s), back
  const detour: XY[] = [
    [0, 0],
    [800, 0],
    [800, 82],
    [1000, 82],
    [1000, 0],
    [2000, 0],
  ];

  it('goes off the track after 2 positions and comes back under 20 m', () => {
    const fixes = rideAlong(detour, { speed: 5 });
    const placements = place(line, fixes);
    // the true distance from the track at each position
    const gaps = fixes.map((_, k) => Math.abs(pointAlong(detour, k * 5)[1]));
    const firstBeyond30 = gaps.findIndex((y) => y > 30);
    // the first position beyond 30 m only counts; the second one is "off"
    expect((placements[firstBeyond30] as Placement).phase).toBe('onTrack');
    const firstOff = placements.findIndex((p) => p.phase === 'offTrack');
    expect(firstOff).toBe(firstBeyond30 + 1);
    // off the track: the distance to the track, and what is left to ride
    const mid = placements[200] as Placement; // along 1 000 m: at (918, 82)
    expect(mid.phase).toBe('offTrack');
    expect(mid.gapM).toBeCloseTo(82, 0);
    expect(mid.targetM).toBeCloseTo(918, -1);
    expect(remainingM(line, mid)).toBeCloseTo(1082, -1);
    expect(mid.progressM).toBeCloseTo(800, -1); // the progress does not move
    // back on the track as soon as one position is under 20 m, where it should be
    const backAt = placements.findIndex(
      (p, k) => k > firstOff && p.phase === 'onTrack',
    );
    expect(gaps[backAt]).toBeLessThan(20);
    expect(gaps[backAt - 1]).toBeGreaterThanOrEqual(20);
    expect((placements[backAt] as Placement).progressM).toBeCloseTo(1000, -1);
    const last = placements[placements.length - 1] as Placement;
    expect(last.phase).toBe('onTrack');
    expect(last.progressM).toBeCloseTo(2000, -1);
  });

  it('does not blink between 20 and 30 m', () => {
    const wobble = [22, 29, 25, 21, 28, 23, 29.5, 26, 24, 29];
    const onTrack = Array.from({ length: 5 }, (_, k) =>
      fixAt([100 + k * 5, 0], k),
    );
    // on the track: 10 positions between 20 and 30 m change nothing
    const stays = place(line, [
      ...onTrack,
      ...wobble.map((y, k) => fixAt([125 + k * 5, y], 5 + k)),
    ]);
    expect(stays.every((p) => p.phase === 'onTrack')).toBe(true);

    // off the track: the same positions change nothing either, then one under 20 m
    const away = [60, 60, 60].map((y, k) => fixAt([125 + k * 5, y], 5 + k));
    const wobbling = wobble.map((y, k) => fixAt([140 + k * 5, y], 8 + k));
    const off = place(line, [
      ...onTrack,
      ...away,
      ...wobbling,
      fixAt([190, 15], 18),
    ]);
    expect(off.slice(5, 7).map((p) => p.phase)).toEqual([
      'onTrack',
      'offTrack',
    ]);
    expect(off.slice(6, 18).every((p) => p.phase === 'offTrack')).toBe(true);
    expect(off[18]?.phase).toBe('onTrack');
  });

  it('is back on the right passage after a detour near the other arm of switchbacks', () => {
    const arms = lineOfPath(switchbacks(600, 20, 4));
    const ride: XY[] = [
      [0, 0],
      [300, 0],
      [300, -40],
      [330, -40],
      [330, 0],
      [600, 0],
    ];
    const placements = place(arms, rideAlong(ride, { speed: 5 }));
    const last = placements[placements.length - 1] as Placement;
    expect(last.phase).toBe('onTrack');
    expect(last.progressM).toBeCloseTo(600, -1);
  });
});

describe('start away from the track, and finding it again', () => {
  const line = lineOfPath([
    [0, 0],
    [2000, 0],
  ]);

  it('shows the distance to the start, then starts where the track is reached', () => {
    // from the parking, 500 m from the track, going south-east
    const ride: XY[] = [
      [-300, 500],
      [200, 0],
      [2000, 0],
    ];
    const placements = place(line, rideAlong(ride, { speed: 5 }));
    const first = placements[0] as Placement;
    expect(first.phase).toBe('approach');
    expect(first.gapM).toBeCloseTo(Math.hypot(300, 500), 0);
    const reached = placements.findIndex((p) => p.phase === 'onTrack');
    // under 20 m of the track on the diagonal: x = 180 m
    expect((placements[reached] as Placement).progressM).toBeCloseTo(180, -1);
    expect(
      placements.slice(0, reached).every((p) => p.phase === 'approach'),
    ).toBe(true);
    // what is left does not count the way to the track
    expect(remainingM(line, first)).toBeCloseTo(line.lengthM, 3);
  });

  it('keeps the passages in the heading of the rider (out-and-back)', () => {
    const aller = lineOfPath(outAndBack(2000));
    // arriving from the north-east, going south-west, onto the way back
    const ride: XY[] = [
      [800, 200],
      [720, 15],
      [600, 0],
    ];
    const placements = place(aller, rideAlong(ride, { speed: 8 }));
    const reached = placements.find((p) => p.phase === 'onTrack') as Placement;
    expect(reached.trackBearing).toBeCloseTo(270, 0);
    expect(reached.progressM).toBeGreaterThan(2000);
  });

  it('takes the start, not the end, when the loop ends at its start', () => {
    const closed = lineOfPath(loop(300));
    const fixes = rideAlong(loop(300), { toM: 100 });
    const placements = place(closed, fixes);
    expect(
      (placements[placements.length - 1] as Placement).progressM,
    ).toBeLessThan(150);
  });

  it('goes forward to a later passage after 5 positions off the track', () => {
    const u = lineOfPath([
      [0, 0],
      [1000, 0],
      [1000, 300],
      [0, 300],
    ]);
    // on the first arm at 500 m, then the GPS gives the second arm
    const ride = [
      ...rideAlong(
        [
          [600, 0],
          [700, 0],
        ],
        { speed: 5 },
      ),
      ...Array.from({ length: 8 }, (_, k) => fixAt([500, 300], 21 + k)),
    ];
    const placements = place(u, ride);
    const onArm2 = placements.findIndex((p) => p.progressM > 1700);
    // 2 positions to go off the track, 5 more positions before looking farther
    expect(onArm2).toBe(21 + 6);
    expect((placements[onArm2] as Placement).progressM).toBeCloseTo(
      1000 + 300 + 500,
      -1,
    );
    expect(
      placements.slice(22, onArm2).every((p) => p.phase === 'offTrack'),
    ).toBe(true);
  });

  it('goes back to an earlier passage after 5 positions off the track', () => {
    const u = lineOfPath([
      [0, 0],
      [1000, 0],
      [1000, 300],
      [0, 300],
    ]);
    const ride = [
      ...rideAlong(
        [
          [600, 300],
          [500, 300],
        ],
        { speed: 5 },
      ),
      ...Array.from({ length: 8 }, (_, k) => fixAt([700, 0], 21 + k)),
    ];
    // the GPS gives the first arm, before the progress: back to the start of the line
    const placements = place(u, ride);
    const last = placements[placements.length - 1] as Placement;
    expect(last.phase).toBe('onTrack');
    expect(last.progressM).toBeCloseTo(700, -1);
  });
});

describe('arrival and camera', () => {
  const line = lineOfPath([
    [0, 0],
    [2000, 0],
  ]);

  it('is within 30 m of the last point and after 90 % of the line', () => {
    const near = fixAt([1975, 0], 0);
    const onTrack = { ...initialPlacement(), phase: 'onTrack' as const };
    expect(hasArrived(line, { ...onTrack, progressM: 1900 }, near)).toBe(true);
    expect(hasArrived(line, { ...onTrack, progressM: 1700 }, near)).toBe(false);
    expect(
      hasArrived(line, { ...onTrack, progressM: 1900 }, fixAt([1960, 0], 0)),
    ).toBe(false);
    expect(hasArrived(line, initialPlacement(), near)).toBe(false);
  });

  it('turns the camera with the track on the track, with the movement off it', () => {
    const placements = place(
      line,
      rideAlong(
        [
          [0, 0],
          [100, 0],
        ],
        { speed: 5 },
      ),
    );
    expect(cameraBearing(placements[3] as Placement)).toBeCloseTo(90, 0);
    expect(cameraBearing(initialPlacement())).toBeNull();
    const off = place(line, [
      fixAt([300, 100], 0),
      fixAt([300, 70], 1),
      fixAt([300, 40], 2),
    ]);
    expect(cameraBearing(off[2] as Placement)).toBeCloseTo(180, 0);
  });
});

describe('time to place a position on a track of 35 km', () => {
  it('is far under 50 ms, on the track and on the whole line', () => {
    const points = decodePolyline6(line3.polyline6) as LonLat[];
    const long = buildLine(points);
    expect(long.lengthM).toBeGreaterThan(35_000);
    const middle = Math.floor(long.points.length / 2);
    const fixOf = (i: number, at: number): Fix => {
      const p = long.points[i] as LonLat;
      return { lon: p[0], lat: p[1], accuracy: 5, at };
    };
    // 100 positions on the track, one per second, in the middle of it
    let placement = placeFix(long, initialPlacement(), fixOf(middle, 0));
    const t0 = performance.now();
    for (let k = 1; k <= 100; k++) {
      placement = placeFix(long, placement, fixOf(middle + k, k * 1000));
    }
    const onTrackMs = (performance.now() - t0) / 100;
    // the search on the whole line (start of the tracking, or a long way off)
    const t1 = performance.now();
    for (let k = 0; k < 20; k++) {
      placeFix(long, initialPlacement(), fixOf(middle, 0));
    }
    const wholeMs = (performance.now() - t1) / 20;
    expect(placement.phase).toBe('onTrack');
    expect(onTrackMs).toBeLessThan(50);
    expect(wholeMs).toBeLessThan(50);
    console.info(
      `35 km track (${long.points.length} points), mean of many runs: ${onTrackMs.toFixed(3)} ms on the track, ${wholeMs.toFixed(3)} ms on the whole line`,
    );
  });

  it('keeps the length of the fabricated paths in sync', () => {
    expect(
      pathLength([
        [0, 0],
        [3, 4],
      ]),
    ).toBe(5);
  });
});
