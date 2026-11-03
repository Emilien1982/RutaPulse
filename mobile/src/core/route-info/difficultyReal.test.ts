// Real answers of trace_attributes (T1 trial of phase 5b, M1 and M2, both
// platforms) with a table extract. Expected values come from an independent
// Python script, written from the spec only (ADR 0011, section 5):
// /Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t5/reference-m1-m2.py
// (its output: reference-m1-m2-sortie.txt). The levels of the ways were
// checked on the OSM extract (t1-essai/controle-osm-sortie.txt).
import { parseTraceResponse } from '../routing/infoResponse';

import { parseDifficultyTable, summarizeDifficulty } from './difficulty';
import type { LegInfo } from './routeInfo';

import androidM1 from './fixtures/p05b-android-M1-trace-way.json';
import androidM2 from './fixtures/p05b-android-M2-trace-way.json';
import iosM1 from './fixtures/p05b-ios-M1-trace-way.json';
import iosM2 from './fixtures/p05b-ios-M2-trace-way.json';

const S1 = [340172445, 340171810, 340171838, 788131352];
const S2 = [
  340171837, 371765201, 371765202, 371765204, 371765206, 371765207, 371765208,
  375830372, 375830380,
];
const table = parseDifficultyTable(
  JSON.stringify({
    formatVersion: 1,
    waysByLevel: [[], S1, S2, [], [], [], []],
  }),
);

function leg(record: { response: unknown }): LegInfo {
  const terrain = parseTraceResponse(JSON.stringify(record.response));
  if (!terrain.ok) throw new Error('fixture refused');
  return { mode: 'path', handKm: 0, height: undefined, terrain };
}
function run(legs: LegInfo[]) {
  const r = summarizeDifficulty(legs, table);
  if (r.status !== 'ready') throw new Error(r.status);
  return r.shares;
}

describe.each([
  ['ios', iosM1, iosM2],
  ['android', androidM1, androidM2],
])('real answers, %s', (_name, m1, m2) => {
  it('M1: S1 27 %, S2 2 %, unknown 71 % (reference script)', () => {
    const shares = run([leg(m1)]);
    expect(shares.map((s) => [s.part, s.percent])).toEqual([
      [1, 27],
      [2, 2],
      ['unknown', 71],
    ]);
    expect(shares[0]?.km).toBeCloseTo(1.555, 6);
    expect(shares[1]?.km).toBeCloseTo(0.085, 6);
    expect(shares[2]?.km).toBeCloseTo(4.054, 6);
  });

  it('M2: S2 13 %, unknown 87 % (reference script)', () => {
    const shares = run([leg(m2)]);
    expect(shares.map((s) => [s.part, s.percent])).toEqual([
      [2, 13],
      ['unknown', 87],
    ]);
    expect(shares[0]?.km).toBeCloseTo(0.679, 6);
    expect(shares[1]?.km).toBeCloseTo(4.374, 6);
  });

  it('M1 then M2 as two legs: S1 15 %, S2 7 %, unknown 78 % (reference script)', () => {
    const shares = run([leg(m1), leg(m2)]);
    expect(shares.map((s) => [s.part, s.percent])).toEqual([
      [1, 15],
      [2, 7],
      ['unknown', 78],
    ]);
    expect(shares.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });
});
