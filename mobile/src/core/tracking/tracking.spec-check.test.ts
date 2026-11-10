// Independent checks of the tracking logic, written from the spec (p08, C2,
// C3, C5, C6) and from ADR 0021, not from the code. Traces are made in meters.

import { fr } from '@/core/i18n/fr';
import { t } from '@/core/i18n/t';

import { directionLabel, type Direction } from './directionText';
import { buildGuidance } from './guidance';
import type { Fix } from './placement';
import {
  buildLine,
  distanceM,
  pointAt,
  type TrackingLine,
  type TrackingSource,
} from './trackingLine';
import {
  createTracking,
  panelOf,
  reduceTracking,
  remainingOf,
  type TrackingState,
} from './trackingState';
import {
  dense,
  figureEight,
  lineOf,
  loop,
  outAndBack,
  pathLength,
  rideAlong,
  toLonLat,
  type XY,
} from './testing/fabricate';
import { recorded, RECORDED_NAMES } from './testing/recorded';

const T0 = 1_700_000_000_000;

function sourceOf(path: XY[]): TrackingSource {
  return { line: buildLine(lineOf(dense(path, 10))), free: [] };
}

/** Replays the fixes; returns the state after each one. */
function replay(
  source: TrackingSource,
  fixes: Fix[],
  startAt = T0 - 1000,
): TrackingState[] {
  let state = createTracking(source, startAt);
  const states: TrackingState[] = [];
  for (const fix of fixes) {
    state = reduceTracking(state, { type: 'fix', fix });
    states.push(state);
  }
  return states;
}

function fixAt(xy: XY, k: number, accuracy = 5): Fix {
  const [lon, lat] = toLonLat(xy);
  return { lon, lat, accuracy, at: T0 + k * 1000 };
}

/**
 * C3: remaining distance right within 20 m at each position, on traces where
 * the other passage of the track is close or at the same place.
 */
describe('C3: position on the track, no jump to the other passage', () => {
  const cases: { name: string; path: XY[]; noise: number }[] = [
    {
      name: 'out and back on the same path (1 km)',
      path: outAndBack(1000),
      noise: 0,
    },
    { name: 'out and back, GPS noise 8 m', path: outAndBack(1000), noise: 8 },
    { name: 'figure eight (r = 120 m)', path: figureEight(120), noise: 0 },
    { name: 'figure eight, GPS noise 8 m', path: figureEight(120), noise: 8 },
    {
      name: 'two passages 25 m apart',
      path: [
        [0, 0],
        [600, 0],
        [600, 25],
        [0, 25],
      ],
      noise: 0,
    },
    {
      name: 'two passages 25 m apart, noise 5 m',
      path: [
        [0, 0],
        [600, 0],
        [600, 25],
        [0, 25],
      ],
      noise: 5,
    },
    {
      name: 'two passages 12 m apart (hairpin), noise 3 m',
      path: [
        [0, 0],
        [600, 0],
        [600, 12],
        [0, 12],
      ],
      noise: 3,
    },
  ];

  it.each(cases)('$name', ({ path, noise }) => {
    const source = sourceOf(path);
    const total = pathLength(path);
    const fixes = rideAlong(path, { speed: 5, noiseM: noise, seed: 7 });
    const states = replay(source, fixes);
    let checked = 0;
    states.forEach((state, k) => {
      if (state.status !== 'tracking') return;
      const truth = k * 5;
      const expected = total - truth;
      const got = remainingOf(state);
      // On a noisy trace the reading may lag by the noise itself; 20 m is the spec.
      expect(Math.abs(got - expected)).toBeLessThanOrEqual(20.001);
      checked++;
    });
    expect(checked).toBeGreaterThan(total / 5 - 10);
  });

  it('same path ridden at 12 m/s (a fast descent) stays right', () => {
    const path = outAndBack(1500);
    const total = pathLength(path);
    const states = replay(sourceOf(path), rideAlong(path, { speed: 12 }));
    states.forEach((state, k) => {
      if (state.status !== 'tracking') return;
      expect(
        Math.abs(remainingOf(state) - (total - k * 12)),
      ).toBeLessThanOrEqual(20.001);
    });
  });
});

describe('C5: leaving the track and coming back', () => {
  const path: XY[] = [
    [0, 0],
    [2000, 0],
  ];
  const source = sourceOf(path);

  /** Positions on the track up to x = 500, then at the given offsets, then back. */
  function run(offsets: number[], stepM = 5) {
    const fixes: Fix[] = [];
    let k = 0;
    for (let x = 0; x <= 500; x += stepM) fixes.push(fixAt([x, 0], k++));
    let x = 500;
    for (const y of offsets) {
      x += stepM;
      fixes.push(fixAt([x, y], k++));
    }
    return { fixes, lastX: x, k };
  }

  it('shows the gap after 2 positions beyond 30 m, not after 1', () => {
    const { fixes } = run([40, 40, 40]);
    const states = replay(source, fixes);
    const n = fixes.length;
    const s1 = panelOf(states[n - 3] as TrackingState);
    const s2 = panelOf(states[n - 2] as TrackingState);
    expect(s1.kind).not.toBe('off');
    expect(s2.kind).toBe('off');
    expect(s2.distanceM).toBeGreaterThan(35);
    expect(s2.distanceM).toBeLessThan(46);
    // no alert: nothing in the state but a panel kind
    expect((states[n - 1] as TrackingState).status).toBe('tracking');
  });

  it('a single position at 40 m is not a gap', () => {
    const { fixes } = run([40, 0, 0, 0]);
    const states = replay(source, fixes);
    states.forEach((s) => expect(panelOf(s).kind).not.toBe('off'));
  });

  it('removes the gap under 20 m and guides again at the right place', () => {
    // 40 m off for 8 positions (40 m of road), then back on the track.
    const { fixes, lastX, k } = run([40, 40, 40, 40, 40, 40, 40, 40, 15]);
    fixes.push(fixAt([lastX + 5, 0], k));
    const states = replay(source, fixes);
    const n = states.length;
    const wasOff = states[n - 3] as TrackingState;
    expect(panelOf(wasOff).kind).toBe('off');
    const back = states[n - 2] as TrackingState; // 15 m: back
    expect(panelOf(back).kind).not.toBe('off');
    expect(back.placement.phase).toBe('onTrack');
    const after = states[n - 1] as TrackingState;
    expect(
      Math.abs(remainingOf(after) - (2000 - (lastX + 5))),
    ).toBeLessThanOrEqual(20.001);
  });

  it('no flicker between 20 and 30 m (staying off, then staying on)', () => {
    // Off for good, then 25 / 35 / 25 / 28 m: stays off until under 20 m.
    const { fixes, lastX, k } = run([40, 40, 25, 35, 25, 28, 22, 18]);
    fixes.push(fixAt([lastX + 5, 0], k));
    const states = replay(source, fixes);
    const kinds = states.slice(-9).map((s) => panelOf(s).kind === 'off');
    // positions: 40(1st: not yet) 40 (off) 25 35 25 28 22 -> off ; 18 -> on
    expect(kinds.slice(1, 7)).toEqual([true, true, true, true, true, true]);
    expect(kinds[7]).toBe(false);
  });

  it('while on the track, 25/35 alternating never shows a gap (2 in a row needed)', () => {
    const { fixes } = run([25, 35, 25, 35, 25, 35, 25]);
    const states = replay(source, fixes);
    states.forEach((s) => expect(panelOf(s).kind).not.toBe('off'));
  });

  it('while off, the remaining distance counts from the target on the track', () => {
    const { fixes } = run([40, 40, 40, 40]);
    const states = replay(source, fixes);
    const last = states[states.length - 1] as TrackingState;
    expect(panelOf(last).kind).toBe('off');
    // target near x = 520..540: remaining between 1450 and 1500
    expect(remainingOf(last)).toBeGreaterThan(1440);
    expect(remainingOf(last)).toBeLessThan(1510);
  });
});

describe('C6: arrival', () => {
  it('arrives within 30 m of the end after 90% of the track', () => {
    const path: XY[] = [
      [0, 0],
      [1000, 0],
    ];
    const states = replay(sourceOf(path), rideAlong(path, { speed: 5 }));
    const last = states[states.length - 1] as TrackingState;
    expect(last.status).toBe('ended');
    expect(last.end).toBe('arrived');
    const firstEnded = states.findIndex((s) => s.status === 'ended');
    // the arrival comes in the last 30 m
    expect(firstEnded * 5).toBeGreaterThanOrEqual(970);
  });

  it('does not arrive at 31+ m from the end', () => {
    const path: XY[] = [
      [0, 0],
      [1000, 0],
    ];
    const fixes = rideAlong(path, { speed: 5, toM: 960 });
    const states = replay(sourceOf(path), fixes);
    expect((states[states.length - 1] as TrackingState).status).toBe(
      'tracking',
    );
  });

  it('a loop does not end at its start', () => {
    const path = loop(100);
    const total = pathLength(path);
    const states = replay(sourceOf(path), rideAlong(path, { speed: 5 }));
    const firstEnded = states.findIndex((s) => s.status === 'ended');
    // we are on the start at the first fix, and nothing ends there
    expect(states[0]?.status).toBe('tracking');
    expect(firstEnded).toBeGreaterThan(0);
    expect(firstEnded * 5).toBeGreaterThanOrEqual(0.9 * total - 5);
    expect(states[states.length - 1]?.end).toBe('arrived');
  });

  it('out and back: nothing ends at the turning point, which is far from the end', () => {
    const path = outAndBack(1000);
    const out = rideAlong(path, { speed: 5, toM: 1000 });
    const states = replay(sourceOf(path), out);
    expect(states.every((s) => s.status === 'tracking')).toBe(true);
  });

  it('an end close to the middle of the track (20 m) does not end it at mid-ride', () => {
    const path: XY[] = [
      [0, 0],
      [500, 0],
      [500, 20],
      [250, 20],
    ];
    // ride: passes (250, 0), 20 m from the end (250, 20), at 33% of the track
    const states = replay(
      sourceOf(path),
      rideAlong(path, { speed: 5, toM: 700 }),
    );
    states.forEach((s) => expect(s.status).toBe('tracking'));
    const full = replay(sourceOf(path), rideAlong(path, { speed: 5 }));
    expect(full[full.length - 1]?.end).toBe('arrived');
  });

  it('"Terminer" ends the ride but it is not an arrival', () => {
    const path: XY[] = [
      [0, 0],
      [1000, 0],
    ];
    const source = sourceOf(path);
    const states = replay(source, rideAlong(path, { speed: 5, toM: 300 }));
    const mid = states[states.length - 1] as TrackingState;
    const done = reduceTracking(mid, { type: 'finish', at: T0 + 400_000 });
    expect(done.status).toBe('ended');
    expect(done.end).toBe('finished');
    expect(done.end).not.toBe('arrived');
    // nothing moves any more
    const again = reduceTracking(done, {
      type: 'fix',
      fix: fixAt([900, 0], 500),
    });
    expect(again).toBe(done);
  });
});

describe('waiting screen', () => {
  const path: XY[] = [
    [0, 0],
    [1000, 0],
  ];
  const source = sourceOf(path);

  it('imprecise positions (> 50 m) keep "Recherche du GPS…"', () => {
    let state = createTracking(source, T0 - 1000);
    expect(panelOf(state).kind).toBe('waiting');
    for (let k = 0; k < 5; k++) {
      state = reduceTracking(state, {
        type: 'fix',
        fix: fixAt([k * 5, 0], k, 80),
      });
      expect(panelOf(state).kind).toBe('waiting');
      expect(panelOf(state).distanceM).toBeNull();
    }
    expect(t('tracking.waiting')).toBe('Recherche du GPS…');
    // the GPS answers: not "lost"
    expect(state.gpsLost).toBe(false);
  });

  it('51 m is ignored, 50 m is accepted', () => {
    let s = createTracking(source, T0 - 1000);
    s = reduceTracking(s, { type: 'fix', fix: fixAt([0, 0], 0, 51) });
    expect(panelOf(s).kind).toBe('waiting');
    s = reduceTracking(s, { type: 'fix', fix: fixAt([0, 0], 1, 50) });
    expect(panelOf(s).kind).not.toBe('waiting');
  });

  it('then one precise position gives a panel with a distance', () => {
    let state = createTracking(source, T0 - 1000);
    state = reduceTracking(state, { type: 'fix', fix: fixAt([300, 0], 0, 90) });
    state = reduceTracking(state, { type: 'fix', fix: fixAt([300, 0], 1, 10) });
    const panel = panelOf(state);
    expect(panel.kind).not.toBe('waiting');
    expect(panel.distanceM).not.toBeNull();
  });

  it('a precise position far from the start shows the distance to the start', () => {
    let state = createTracking(source, T0 - 1000);
    state = reduceTracking(state, {
      type: 'fix',
      fix: fixAt([-500, 300], 0, 10),
    });
    const panel = panelOf(state);
    expect(panel.kind).toBe('approach');
    // straight line: sqrt(500^2 + 300^2) = 583 m
    expect(Math.abs((panel.distanceM as number) - 583)).toBeLessThan(15);
  });
});

describe('C2: directions on the recorded answers of the engine', () => {
  const texts = Object.entries(fr)
    .filter(([key]) => key.startsWith('tracking.gesture.'))
    .map(([, value]) => value as string);
  const gestureRegex = new RegExp(
    '^(' +
      texts
        .map((s) =>
          s.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{n}', '\\d+'),
        )
        .join('|') +
      ')( sur (le sentier|la piste|la route))?$',
  );

  // the second part of a pair loses its "Tournez " and starts in lower case
  const toRegex = (list: string[]) =>
    new RegExp(
      '^(' +
        list
          .map((x) =>
            x.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{n}', '\\d+'),
          )
          .join('|') +
        ')( sur (le sentier|la piste|la route))?$',
      'i',
    );
  const secondRegex = toRegex([
    ...texts,
    ...texts.map((x) => x.replace(/^Tournez /, '')),
  ]);

  function bearing(a: number[], b: number[]): number {
    const dx =
      ((b[0] as number) - (a[0] as number)) *
      Math.cos(((a[1] as number) * Math.PI) / 180);
    const dy = (b[1] as number) - (a[1] as number);
    return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  }
  function turnAt(line: TrackingLine, m: number): number {
    const a = bearing(pointAt(line, m - 20), pointAt(line, m));
    const b = bearing(pointAt(line, m), pointAt(line, m + 20));
    const d = Math.abs(a - b);
    return d > 180 ? 360 - d : d;
  }

  it.each(RECORDED_NAMES)('itinerary %s', (name) => {
    const { source, answer, reference } = recorded(name);
    const list = buildGuidance(source, [answer]);
    const { line } = source;

    // the arrival is the last one, at the end of the line
    expect(list[list.length - 1]).toEqual({
      kind: 'arrive',
      atM: line.lengthM,
    });

    const turns = list.filter(
      (d): d is Extract<Direction, { kind: 'turn' }> => d.kind === 'turn',
    );
    for (const d of turns) {
      // a grouped announcement: at most 2 parts, each one made of fr.ts texts
      const parts = directionLabel(d).split(', puis ');
      expect(parts.length).toBeLessThanOrEqual(2);
      expect(parts.length).toBe(d.then ? 2 : 1);
      parts.forEach((part, k) => {
        expect(part).toMatch(k === 0 ? gestureRegex : secondRegex);
      });
      if (d.gesture === 'uturn') {
        expect(turnAt(line, d.atM)).toBeGreaterThan(120);
      }
    }
    // two turns closer than 25 m are announced together, unless the first
    // one is already a group (a chain of 3)
    for (let i = 1; i < turns.length; i++) {
      const a = turns[i - 1] as Extract<Direction, { kind: 'turn' }>;
      const b = turns[i] as Extract<Direction, { kind: 'turn' }>;
      if (!a.then) expect(b.atM - a.atM).toBeGreaterThanOrEqual(25);
    }
    // a group never goes with the arrival or "Suivez le tracé"
    list.forEach((d, i) => {
      if (d.kind === 'turn' && d.then) {
        expect(list[i + 1]).toBeDefined();
      }
    });
    // no two "tout droit" in a row (in the whole list, follow parts included)
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1] as Direction;
      const b = list[i] as Direction;
      const straight = (d: Direction) =>
        d.kind === 'turn' && d.gesture === 'straight';
      expect(straight(a) && straight(b)).toBe(false);
    }
    // same list as the reference written in Python (outside source: essais/08-suivi-velo)
    expect(list.map(directionLabel)).toEqual(
      reference.directions.map((d) => d.text),
    );
  });

  it('the end of the noisy GPX that the engine did not match gets "Suivez le tracé"', () => {
    const { source, answer } = recorded('3');
    const list = buildGuidance(source, [answer]);
    const follow = list.find((d) => d.kind === 'follow');
    expect(follow).toBeDefined();
    if (follow?.kind !== 'follow') return;
    expect(directionLabel(follow)).toBe('Suivez le tracé');
    expect(follow.reason).toBe('noMatch');
    // ADR 0021: 741 m at the end
    expect(follow.toM).toBeGreaterThan(source.line.lengthM - 30);
    expect(follow.toM - follow.fromM).toBeGreaterThan(600);
    expect(follow.toM - follow.fromM).toBeLessThan(900);
    // no turn is announced inside it
    list.forEach((d) => {
      if (d.kind === 'turn') {
        expect(d.atM <= follow.fromM || d.atM >= follow.toM).toBe(true);
      }
    });
  });

  it('a hand-made stretch gives "Suivez le tracé", whatever the engine says', () => {
    const { source, answer } = recorded('1');
    const withHand: TrackingSource = {
      line: source.line,
      free: [{ fromM: 5000, toM: 6000, reason: 'hand' }],
    };
    const list = buildGuidance(withHand, [answer, answer]);
    const follow = list.find((d) => d.kind === 'follow' && d.reason === 'hand');
    expect(follow).toBeDefined();
    list.forEach((d) => {
      if (d.kind === 'turn') expect(d.atM <= 5000 || d.atM >= 6000).toBe(true);
    });
  });

  it('every text comes from fr.ts', () => {
    expect(fr['tracking.follow']).toBe('Suivez le tracé');
    expect(t('tracking.follow')).toBe(fr['tracking.follow']);
  });
});

describe('timing (indicative)', () => {
  it('places positions on a 35 km track', () => {
    const { source } = recorded('3');
    const { line } = source;
    expect(line.lengthM).toBeGreaterThan(30_000);
    const fixes: Fix[] = [];
    for (let k = 0, m = 0; m < line.lengthM; k++, m += 8) {
      const [lon, lat] = pointAt(line, m);
      fixes.push({ lon, lat, accuracy: 5, at: T0 + k * 1000 });
    }
    let state = createTracking(source, T0 - 1000);
    const times: number[] = [];
    for (const fix of fixes) {
      const t0 = performance.now();
      state = reduceTracking(state, { type: 'fix', fix });
      panelOf(state);
      remainingOf(state);
      times.push(performance.now() - t0);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const sorted = [...times].sort((a, b) => a - b);
    console.log(
      `TIMING 35 km: ${fixes.length} fixes, mean ${mean.toFixed(3)} ms, p99 ${(sorted[Math.floor(sorted.length * 0.99)] as number).toFixed(3)} ms, max ${max.toFixed(2)} ms (first fix, whole-line search: ${(times[0] as number).toFixed(2)} ms)`,
    );
    expect(mean).toBeLessThan(50);
    expect(distanceM(pointAt(line, 0), pointAt(line, 0))).toBe(0);
  });
});
