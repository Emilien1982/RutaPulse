import type { Direction } from './directionText';
import { initialPlacement, type Fix, type Placement } from './placement';
import { remainingOf } from './trackingState';
import {
  createTracking,
  formatClimbLeft,
  formatRemaining,
  GPS_LOST_MS,
  GPS_SILENT_MS,
  panelDistance,
  panelOf,
  reduceTracking,
  wantsGps,
  type TrackingState,
} from './trackingState';
import {
  dense,
  figureEight,
  lineOf,
  loop,
  rideAlong,
  toLonLat,
  type XY,
} from './testing/fabricate';
import { buildLine, type TrackingSource } from './trackingLine';

const T0 = 1_700_000_000_000;

function sourceOf(path: XY[]): TrackingSource {
  return { line: buildLine(lineOf(dense(path))), free: [] };
}

function runFixes(state: TrackingState, fixes: Fix[]): TrackingState[] {
  const states: TrackingState[] = [];
  let current = state;
  for (const fix of fixes) {
    current = reduceTracking(current, { type: 'fix', fix });
    states.push(current);
  }
  return states;
}

const fixAt = (xy: XY, at: number, accuracy: number | null = 5): Fix => {
  const [lon, lat] = toLonLat(xy);
  return { lon, lat, accuracy, at };
};

describe('createTracking', () => {
  it('starts waiting for the GPS, with every guided stretch free until the directions come', () => {
    const state = createTracking(
      sourceOf([
        [0, 0],
        [2000, 0],
      ]),
      T0,
    );
    expect(state.status).toBe('tracking');
    expect(state.end).toBeNull();
    expect(state.hasFix).toBe(false);
    expect(state.directions.map((d) => d.kind)).toEqual(['follow', 'arrive']);
    expect(state.directions[0]).toMatchObject({ reason: 'noMatch' });
    expect(wantsGps(state)).toBe(true);
    expect(panelOf(state).kind).toBe('waiting');
  });
});

describe('reduceTracking: fixes', () => {
  const source = sourceOf([
    [0, 0],
    [2000, 0],
  ]);

  it('places the fixes, and counts the ride', () => {
    const states = runFixes(
      createTracking(source, T0),
      rideAlong(
        [
          [0, 0],
          [500, 0],
        ],
        { startAt: T0 },
      ),
    );
    const last = states[states.length - 1] as TrackingState;
    expect(last.hasFix).toBe(true);
    expect(last.placement.phase).toBe('onTrack');
    expect(last.placement.progressM).toBeCloseTo(500, -1);
    expect(last.ride.distanceM).toBeGreaterThan(450);
    expect(remainingOf(last)).toBeCloseTo(1500, -1);
  });

  it('processes a position once every 900 ms at most', () => {
    const state = createTracking(source, T0);
    const one = reduceTracking(state, {
      type: 'fix',
      fix: fixAt([100, 0], T0),
    });
    const quick = reduceTracking(one, {
      type: 'fix',
      fix: fixAt([105, 0], T0 + 500),
    });
    expect(quick.placement).toBe(one.placement);
    expect(quick.lastFixAt).toBe(T0);
    expect(quick.signalAt).toBe(T0 + 500); // but the GPS did answer
    const later = reduceTracking(quick, {
      type: 'fix',
      fix: fixAt([105, 0], T0 + 1000),
    });
    expect(later.lastFixAt).toBe(T0 + 1000);
  });

  it('counts a fix of more than 50 m of precision only as "the GPS answers"', () => {
    const state = createTracking(source, T0);
    const next = reduceTracking(state, {
      type: 'fix',
      fix: fixAt([100, 0], T0 + 1000, 80),
    });
    expect(next.hasFix).toBe(true);
    expect(next.placement).toBe(state.placement);
    expect(next.ride.kept).toHaveLength(0);
    expect(panelOf(next)).toMatchObject({ kind: 'waiting', silent: false });
    // then a precise position: the approach, with a distance
    const placed = reduceTracking(next, {
      type: 'fix',
      fix: fixAt([100, 400], T0 + 2000, 10),
    });
    const panel = panelOf(placed);
    expect(panel.kind).toBe('approach');
    expect(panel.distanceM).toBeGreaterThan(400);
  });
});

describe('reduceTracking: lost GPS and waiting message', () => {
  const source = sourceOf([
    [0, 0],
    [2000, 0],
  ]);

  it('waits for 30 s before saying the GPS does not answer', () => {
    const state = createTracking(source, T0);
    const early = reduceTracking(state, {
      type: 'tick',
      at: T0 + GPS_SILENT_MS,
    });
    expect(panelOf(early).silent).toBe(false);
    const late = reduceTracking(state, {
      type: 'tick',
      at: T0 + GPS_SILENT_MS + 1,
    });
    expect(panelOf(late)).toMatchObject({ kind: 'waiting', silent: true });
    // the first fix, even a bad one, ends the message
    const heard = reduceTracking(late, {
      type: 'fix',
      fix: fixAt([0, 0], T0 + 40_000, 90),
    });
    expect(heard.gpsSilent).toBe(false);
  });

  it('loses the GPS after 10 s without a position, and finds it again by itself', () => {
    const [first] = runFixes(createTracking(source, T0), [fixAt([100, 0], T0)]);
    const state = first as TrackingState;
    expect(
      reduceTracking(state, { type: 'tick', at: T0 + GPS_LOST_MS }).gpsLost,
    ).toBe(false);
    const lost = reduceTracking(state, {
      type: 'tick',
      at: T0 + GPS_LOST_MS + 1,
    });
    expect(lost.gpsLost).toBe(true);
    expect(panelOf(lost).gpsLost).toBe(true);
    // the panel keeps its last state
    expect(panelOf(lost).kind).toBe(panelOf(state).kind);
    const back = reduceTracking(lost, {
      type: 'fix',
      fix: fixAt([110, 0], T0 + 12_000),
    });
    expect(back.gpsLost).toBe(false);
  });
});

describe('reduceTracking: pause, resume, finish', () => {
  const source = sourceOf([
    [0, 0],
    [3000, 0],
  ]);

  it('keeps the progress through a pause, with the GPS off, and counts the jump in a straight line', () => {
    const before = runFixes(
      createTracking(source, T0),
      rideAlong(
        [
          [0, 0],
          [500, 0],
        ],
        { startAt: T0 },
      ),
    );
    let state = before[before.length - 1] as TrackingState;
    const progress = state.placement.progressM;
    state = reduceTracking(state, { type: 'pause', at: T0 + 200_000 });
    expect(state.status).toBe('paused');
    expect(wantsGps(state)).toBe(false);
    // a fix that arrives anyway is ignored while paused
    const ignored = reduceTracking(state, {
      type: 'fix',
      fix: fixAt([520, 0], T0 + 201_000),
    });
    expect(ignored).toBe(state);
    expect(state.placement.progressM).toBe(progress);
    // five minutes later: 1 km further. The window has grown by 15 m/s.
    state = reduceTracking(state, { type: 'resume', at: T0 + 500_000 });
    expect(state.status).toBe('tracking');
    expect(wantsGps(state)).toBe(true);
    state = reduceTracking(state, {
      type: 'fix',
      fix: fixAt([1500, 0], T0 + 501_000),
    });
    expect(state.placement.phase).toBe('onTrack');
    expect(state.placement.progressM).toBeCloseTo(1500, -1);
    // 500 m ride before the pause, 1 000 m jump counted in a straight line
    expect(state.ride.distanceM).toBeGreaterThan(1450);
    expect(state.ride.distanceM).toBeLessThan(1520);
  });

  it('does not count the pause as a lost GPS', () => {
    let state = createTracking(source, T0);
    state = reduceTracking(state, { type: 'fix', fix: fixAt([100, 0], T0) });
    state = reduceTracking(state, { type: 'pause', at: T0 + 1000 });
    state = reduceTracking(state, { type: 'tick', at: T0 + 100_000 });
    expect(state.gpsLost).toBe(false);
    state = reduceTracking(state, { type: 'resume', at: T0 + 100_000 });
    state = reduceTracking(state, { type: 'tick', at: T0 + 105_000 });
    expect(state.gpsLost).toBe(false);
  });

  it('finishes by "Terminer": ended, GPS off, the clock of the end kept', () => {
    let state = createTracking(source, T0);
    state = reduceTracking(state, { type: 'fix', fix: fixAt([100, 0], T0) });
    state = reduceTracking(state, { type: 'finish', at: T0 + 60_000 });
    expect(state).toMatchObject({
      status: 'ended',
      end: 'finished',
      endedAt: T0 + 60_000,
    });
    expect(wantsGps(state)).toBe(false);
    // nothing changes it afterwards
    const same = reduceTracking(state, {
      type: 'fix',
      fix: fixAt([900, 0], T0 + 70_000),
    });
    expect(same).toBe(state);
    expect(reduceTracking(state, { type: 'resume', at: T0 + 80_000 })).toBe(
      state,
    );
    expect(reduceTracking(state, { type: 'finish', at: T0 + 90_000 })).toBe(
      state,
    );
  });

  it('takes the directions when they are ready, at any time', () => {
    const state = createTracking(source, T0);
    const directions: Direction[] = [
      { kind: 'turn', atM: 300, gesture: 'turn', side: 'left', way: 'trail' },
      { kind: 'arrive', atM: source.line.lengthM },
    ];
    const next = reduceTracking(state, { type: 'guidance', directions });
    expect(next.directions).toBe(directions);
    expect(next.placement).toBe(state.placement);
  });
});

describe('C6: arrival', () => {
  /** The first state that is ended, and its index. */
  function firstEnded(source: TrackingSource, fixes: Fix[]) {
    const states = runFixes(createTracking(source, T0), fixes);
    const index = states.findIndex((s) => s.status === 'ended');
    return { states, index, ended: states[index] };
  }

  it('one way: at 30 m of the end, after 90 % of the line', () => {
    const path: XY[] = [
      [0, 0],
      [2000, 0],
    ];
    const fixes = rideAlong(path, { noiseM: 8, seed: 11, startAt: T0 });
    const { index, ended } = firstEnded(sourceOf(path), fixes);
    expect(ended).toMatchObject({ status: 'ended', end: 'arrived' });
    expect(ended?.endedAt).toBe(fixes[index]?.at);
    // not before the rider is within 30 m of the end (noise of 8 m at most)
    const trueX = index * 5;
    expect(trueX).toBeGreaterThanOrEqual(1960);
    expect(trueX).toBeLessThanOrEqual(2000);
    expect(wantsGps(ended as TrackingState)).toBe(false);
    // it ended at that position: the next ones are not read
    expect(ended?.ride.kept.length).toBeGreaterThan(150);
  });

  it('a loop does not finish at its start, but at its end', () => {
    const path = loop(300);
    const fixes = rideAlong(path, { noiseM: 8, seed: 12, startAt: T0 });
    const { states, index } = firstEnded(sourceOf(path), fixes);
    // all the fixes at the start (and all the fixes before 90 %) leave it running
    expect(states.slice(0, 20).every((s) => s.status === 'tracking')).toBe(
      true,
    );
    expect(index).toBeGreaterThan(fixes.length - 12);
    expect(states[index]?.end).toBe('arrived');
  });

  it('a figure eight (start = end = crossing) does not finish at the crossing in the middle', () => {
    const path = figureEight(150);
    const fixes = rideAlong(path, { startAt: T0 });
    const { states, index } = firstEnded(sourceOf(path), fixes);
    const middle = states[Math.floor(fixes.length / 2)] as TrackingState;
    expect(middle.status).toBe('tracking');
    expect(index).toBeGreaterThan(fixes.length - 12);
  });

  it('finishes when the rider reaches the end after 90 %, but not when under 90 % of the line is done', () => {
    const path: XY[] = [
      [0, 0],
      [2000, 0],
    ];
    // the rider starts at the end: the line is reached there, 100 % in, but approach first
    const fixes = rideAlong(
      [
        [1990, 0],
        [2000, 0],
      ],
      { startAt: T0, speed: 2 },
    );
    const { states } = firstEnded(sourceOf(path), fixes);
    // placed at 1 990 m (more than 90 %) and within 30 m: it is an arrival
    expect(states[states.length - 1]?.status).toBe('ended');
    // 80 % of the line is not enough
    const early = firstEnded(
      sourceOf([
        [0, 0],
        [2000, 0],
        [2000, 400],
      ]),
      rideAlong(
        [
          [1990, 0],
          [2000, 0],
        ],
        { startAt: T0, speed: 2 },
      ),
    );
    expect(early.index).toBe(-1);
  });

  it('can arrive while off the track, between 20 and 30 m from it', () => {
    const path: XY[] = [
      [0, 0],
      [2000, 0],
    ];
    const source = sourceOf(path);
    const on = rideAlong(
      [
        [0, 0],
        [1900, 0],
      ],
      { speed: 10, startAt: T0 },
    );
    const away = [60, 60, 60, 60].map((y, k) =>
      fixAt([1910 + k * 10, y], T0 + (190 + k) * 1000),
    );
    const states = runFixes(createTracking(source, T0), [...on, ...away]);
    const off = states[states.length - 1] as TrackingState;
    expect(off.placement.phase).toBe('offTrack');
    expect(off.status).toBe('tracking');
    // at 25 m of the last point (and of the line): it stays off the track, and it is the arrival
    const end = reduceTracking(off, {
      type: 'fix',
      fix: fixAt([2000, 25], T0 + 200_000),
    });
    expect(end.placement.phase).toBe('offTrack');
    expect(end).toMatchObject({ status: 'ended', end: 'arrived' });
  });
});

describe('panelOf (mock-up 30, order of priority)', () => {
  const source = sourceOf([
    [0, 0],
    [2000, 0],
  ]);
  const base = createTracking(source, T0);
  const directions: Direction[] = [
    { kind: 'turn', atM: 300, gesture: 'slight', side: 'left', way: 'trail' },
    { kind: 'follow', fromM: 500, toM: 700, reason: 'hand' },
    { kind: 'turn', atM: 900, gesture: 'turn', side: 'right' },
    { kind: 'arrive', atM: 2000 },
  ];
  const at = (
    patch: Partial<Placement>,
    extra: Partial<TrackingState> = {},
  ): TrackingState => ({
    ...base,
    directions,
    hasFix: true,
    placement: {
      ...initialPlacement(),
      phase: 'onTrack',
      prev: [6, 48.7],
      ...patch,
    },
    ...extra,
  });

  it('waits for the GPS first', () => {
    expect(panelOf({ ...base, directions })).toMatchObject({
      kind: 'waiting',
      distanceM: null,
    });
  });

  it('shows the distance to the start before the track is reached', () => {
    const panel = panelOf(at({ phase: 'approach', gapM: 500 }));
    expect(panel).toMatchObject({
      kind: 'approach',
      distanceM: 500,
      direction: null,
      imminent: false,
    });
  });

  it('shows the distance to the track when off it, never yellow', () => {
    const panel = panelOf(
      at({ phase: 'offTrack', progressM: 290, gapM: 80, targetM: 320 }),
    );
    expect(panel).toMatchObject({
      kind: 'off',
      distanceM: 80,
      imminent: false,
    });
  });

  it('shows the next direction, yellow at 100 m or less', () => {
    const far = panelOf(at({ progressM: 100 }));
    expect(far).toMatchObject({
      kind: 'turn',
      distanceM: 200,
      imminent: false,
    });
    expect(far.direction).toBe(directions[0]);
    const near = panelOf(at({ progressM: 200 }));
    expect(near).toMatchObject({ distanceM: 100, imminent: true });
    expect(panelOf(at({ progressM: 201 })).imminent).toBe(true);
    expect(panelOf(at({ progressM: 199 })).imminent).toBe(false);
  });

  it('announces a stretch without direction ahead as a direction, on white', () => {
    const panel = panelOf(at({ progressM: 450 }));
    expect(panel.kind).toBe('turn');
    expect(panel.direction).toBe(directions[1]);
    expect(panel).toMatchObject({ distanceM: 50, imminent: false });
  });

  it('says "follow the track" inside the stretch, with its distance and its reason', () => {
    const panel = panelOf(at({ progressM: 600 }));
    expect(panel).toMatchObject({
      kind: 'follow',
      distanceM: 100,
      reason: 'hand',
      imminent: false,
    });
  });

  it('announces the arrival after the last direction, yellow at 100 m or less', () => {
    expect(panelOf(at({ progressM: 1000 }))).toMatchObject({
      kind: 'arrive',
      distanceM: 1000,
      imminent: false,
    });
    expect(panelOf(at({ progressM: 1900 }))).toMatchObject({
      kind: 'arrive',
      distanceM: 100,
      imminent: true,
    });
  });

  it('keeps "Suivez le tracé" with the reason when the stretch without direction goes to the end, until the arrival is in sight', () => {
    const toEnd: Direction[] = [
      { kind: 'follow', fromM: 1500, toM: 2000, reason: 'outOfZone' },
      { kind: 'arrive', atM: 2000 },
    ];
    const panel = panelOf(at({ progressM: 1600 }, { directions: toEnd }));
    expect(panel).toMatchObject({
      kind: 'follow',
      distanceM: 400,
      reason: 'outOfZone',
      imminent: false,
    });
    expect(panel.direction).toEqual(toEnd[0]);
    const near = panelOf(at({ progressM: 1950 }, { directions: toEnd }));
    expect(near).toMatchObject({
      kind: 'arrive',
      reason: 'outOfZone',
      imminent: true,
    });
    expect(near.direction).toEqual({ kind: 'arrive', atM: 2000 });
  });

  it('says nothing about the reason of a stretch the engine did not match', () => {
    const lost: Direction[] = [
      { kind: 'follow', fromM: 0, toM: 2000, reason: 'noMatch' },
      { kind: 'arrive', atM: 2000 },
    ];
    expect(panelOf(at({ progressM: 100 }, { directions: lost }))).toMatchObject(
      { kind: 'follow', reason: null },
    );
  });

  it('adds "GPS lost" without replacing the state', () => {
    expect(panelOf(at({ progressM: 100 }, { gpsLost: true }))).toMatchObject({
      kind: 'turn',
      gpsLost: true,
    });
  });
});

describe('formats of the numbers (mock-up 30)', () => {
  it.each([
    [1200, '1,2', 'km'],
    [12_000, '12', 'km'],
    [12_400, '12', 'km'],
    [650, '650', 'm'],
    [620, '600', 'm'],
    [830, '850', 'm'],
    [300, '300', 'm'],
    [170, '170', 'm'],
    [172, '170', 'm'],
    [48, '50', 'm'],
    [4, '10', 'm'],
    [0, '10', 'm'],
    [999, '1,0', 'km'],
    [9949, '9,9', 'km'],
    [9950, '10', 'km'],
    [9999, '10', 'km'],
  ])('the big distance of %i m is %s %s', (meters, value, unit) => {
    expect(panelDistance(meters)).toEqual({ value, unit });
  });

  it.each([
    [17_800, '17,8 km'],
    [18_040, '18,0 km'],
    [1000, '1,0 km'],
    [850, '850 m'],
    [854, '850 m'],
    [50, '50 m'],
    [0, '0 m'],
    [100_400, '100 km'],
  ])('"Reste" for %i m is %s', (meters, text) => {
    expect(formatRemaining(meters)).toBe(text);
  });

  it('writes the ascent left in whole meters, or a dash', () => {
    expect(formatClimbLeft(421)).toBe('421 m');
    expect(formatClimbLeft(1250)).toBe('1 250 m');
    expect(formatClimbLeft(0)).toBe('0 m');
    expect(formatClimbLeft(null)).toBe('—');
  });
});
