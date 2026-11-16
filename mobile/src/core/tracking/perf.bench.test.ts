// Bench C12 (phase 8a, p08 spec): « une position est traitée en moins de
// 50 ms ». Written by the tester from the spec, not from the code.
//
// What it measures: the time of each call to `reduceTracking` for one
// position, on a 34.9 km circuit (fixture nancyCircuits.json, OSM 15712020,
// one position every 10 m, one per second), with the directions of the
// tracking when they are available (recorded engine answers, same circuit).
// Caveat: this runs in Node (V8) under Jest, NOT in Hermes on a phone. It
// checks the algorithm (no pass over the whole line per position), not the
// speed of the phone.

import { type Fix } from './placement';
import { buildGuidance } from './guidance';
import { recorded } from './testing/recorded';
import { buildLine, pointAt, type TrackingSource } from './trackingLine';
import {
  createTracking,
  panelOf,
  reduceTracking,
  remainingOf,
  type TrackingState,
} from './trackingState';

import circuits from '@/core/routes/fixtures/nancyCircuits.json';

const T0 = 1_700_000_000_000;
const STEP_M = 10;
const MAX_MS = 50;

type Stats = { n: number; max: number; p99: number; mean: number; at: number };

function stats(times: number[]): Stats {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    n: times.length,
    max: sorted[sorted.length - 1] as number,
    p99: sorted[
      Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))
    ] as number,
    mean,
    at: times.indexOf(sorted[sorted.length - 1] as number),
  };
}

function show(label: string, s: Stats): void {
  console.log(
    `BENCH C12 ${label}: ${s.n} positions, max ${s.max.toFixed(3)} ms (position no ${s.at}), p99 ${s.p99.toFixed(3)} ms, mean ${s.mean.toFixed(3)} ms`,
  );
}

const circuit = circuits.circuits.find((c) => c.osm_id === 15712020);

/** Positions of the fixture circuit, one every 10 m, one per second. */
function trackFixes(): Fix[] {
  const line = buildLine(circuit?.ordered as [number, number][]);
  const fixes: Fix[] = [];
  for (let k = 0, m = 0; m <= line.lengthM; k++, m += STEP_M) {
    const [lon, lat] = pointAt(line, m);
    fixes.push({ lon, lat, accuracy: 5, at: T0 + k * 1000 });
  }
  return fixes;
}

function run(
  source: TrackingSource,
  directions: ReturnType<typeof buildGuidance> | null,
  fixes: Fix[],
  withPanel: boolean,
): { times: number[]; end: TrackingState } {
  let state = createTracking(source, T0 - 1000);
  if (directions !== null) {
    state = reduceTracking(state, { type: 'guidance', directions });
  }
  const times: number[] = [];
  for (const fix of fixes) {
    const t0 = performance.now();
    state = reduceTracking(state, { type: 'fix', fix });
    if (withPanel) {
      panelOf(state);
      remainingOf(state);
    }
    times.push(performance.now() - t0);
  }
  return { times, end: state };
}

describe('C12: time to process one position (Node, not Hermes)', () => {
  const fixes = trackFixes();
  const { source, answer } = recorded('3d');
  const directions = buildGuidance(source, [answer]);

  it('uses a circuit of about 35 km, one position every 10 m', () => {
    expect(circuit).toBeDefined();
    expect(fixes.length).toBeGreaterThan(3300);
    expect(fixes.length).toBeLessThan(3700);
    // the recorded line is the same circuit as the fixture
    expect(
      Math.abs(source.line.lengthM - (circuit?.ordered_m ?? 0)),
    ).toBeLessThan(0.02 * source.line.lengthM);
    expect(directions.length).toBeGreaterThan(10);
  });

  it('reduceTracking: max under 50 ms, with the directions', () => {
    const { times, end } = run(source, directions, fixes, false);
    const s = stats(times);
    show('reduceTracking, with directions', s);
    // the track was really followed up to the arrival
    expect(end.status).toBe('ended');
    expect(end.end).toBe('arrived');
    expect(s.max).toBeLessThan(MAX_MS);
  });

  it('reduceTracking: max under 50 ms, without directions', () => {
    const { times } = run(source, null, fixes, false);
    const s = stats(times);
    show('reduceTracking, without directions', s);
    expect(s.max).toBeLessThan(MAX_MS);
  });

  it('with the panel and the remaining distance computed too: max under 50 ms', () => {
    const { times } = run(source, directions, fixes, true);
    const s = stats(times);
    show('reduceTracking + panelOf + remainingOf', s);
    expect(s.max).toBeLessThan(MAX_MS);
  });
});
