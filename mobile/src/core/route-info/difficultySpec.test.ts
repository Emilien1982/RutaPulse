// Spec phase 5b, C5: shares by length, 100 %, hand leg and missing way ids
// are "unknown", a table of another format makes everything "unknown".
// Expected values are worked out by hand in each test.
import { parseTraceResponse } from '../routing/infoResponse';

import { parseDifficultyTable, summarizeDifficulty } from './difficulty';
import type { LegInfo } from './routeInfo';

const tableText = (formatVersion: number) =>
  JSON.stringify({
    formatVersion,
    waysByLevel: [[], [100], [200], [300], [], [], [600]],
  });
const T = parseDifficultyTable(tableText(1));

// Built from the raw answer text, like the app does (way_id 0, absent...).
function pathLeg(edges: object[]): LegInfo {
  const terrain = parseTraceResponse(JSON.stringify({ edges }));
  return { mode: 'path', handKm: 0, height: undefined, terrain };
}
const edge = (length: number, way_id?: unknown) => ({
  use: 'path',
  density: 1,
  length,
  ...(way_id === undefined ? {} : { way_id }),
});
function shares(legs: LegInfo[], table = T) {
  const r = summarizeDifficulty(legs, table);
  if (r.status !== 'ready') throw new Error(r.status);
  return r.shares.map((s) => [s.part, s.percent]);
}

describe('C5 shares', () => {
  it('weights by length, not by number of edges', () => {
    // S1 1 km (1 edge), S3 3 km (3 edges of 1 km... as one 3 km edge),
    // unknown 6 km: 10 %, 30 %, 60 %.
    expect(
      shares([pathLeg([edge(1, 100), edge(3, 300), edge(6, 999)])]),
    ).toEqual([
      [3, 30],
      [1, 10],
      ['unknown', 60],
    ]);
  });

  it('sums to 100 whatever the rounding (three parts of one third)', () => {
    const r = shares([pathLeg([edge(1, 100), edge(1, 200), edge(1, 300)])]);
    expect(r.reduce((sum, [, p]) => sum + (p as number), 0)).toBe(100);
  });

  it('a hand leg is entirely unknown, with its straight-line length', () => {
    const hand: LegInfo = {
      mode: 'hand',
      handKm: 3,
      height: undefined,
      terrain: undefined,
    };
    // S2 1 km + hand 3 km: 25 % and 75 %.
    expect(shares([pathLeg([edge(1, 200)]), hand])).toEqual([
      [2, 25],
      ['unknown', 75],
    ]);
  });

  it.each([[0], [undefined], [-3], [1.5], ['100']])(
    'way_id %p is unknown, even next to a known way',
    (wayId) => {
      expect(shares([pathLeg([edge(1, 100), edge(1, wayId)])])).toEqual([
        [1, 50],
        ['unknown', 50],
      ]);
    },
  );

  it('a way absent from the table is unknown', () => {
    expect(shares([pathLeg([edge(2, 424242)])])).toEqual([['unknown', 100]]);
  });

  it('reads every level S0 to S6 (S0 and S6 included)', () => {
    const t = parseDifficultyTable(
      JSON.stringify({
        formatVersion: 1,
        waysByLevel: [[1], [2], [3], [4], [5], [6], [7]],
      }),
    );
    const edges = [1, 2, 3, 4, 5, 6, 7].map((w) => edge(1, w));
    // Seven equal parts: 14.28 % each, 2 points go to the first two (tie).
    expect(shares([pathLeg(edges)], t)).toEqual([
      [0, 15],
      [1, 15],
      [2, 14],
      [3, 14],
      [4, 14],
      [5, 14],
      [6, 14],
    ]);
  });

  it('formatVersion other than 1: everything is unknown', () => {
    expect(
      shares([pathLeg([edge(1, 100)])], parseDifficultyTable(tableText(2))),
    ).toEqual([['unknown', 100]]);
    expect(
      shares([pathLeg([edge(1, 100)])], parseDifficultyTable(tableText(0))),
    ).toEqual([['unknown', 100]]);
  });
});

describe('C7 order', () => {
  it('known levels from the most frequent to the least, then unknown', () => {
    // S1 1 km, S2 2 km, S3 3 km, unknown 4 km (unknown is longest, still last).
    expect(
      shares([
        pathLeg([edge(1, 100), edge(2, 200), edge(3, 300), edge(4, 999)]),
      ]),
    ).toEqual([
      [3, 30],
      [2, 20],
      [1, 10],
      ['unknown', 40],
    ]);
  });

  it('no unknown part when everything is known', () => {
    expect(shares([pathLeg([edge(1, 100)])])).toEqual([[1, 100]]);
  });

  it('a share under 1 % is kept with percent 0', () => {
    const r = summarizeDifficulty(
      [pathLeg([edge(0.001, 100), edge(9.999, 999)])],
      T,
    );
    if (r.status !== 'ready') throw new Error(r.status);
    expect(r.shares[0]?.part).toBe(1);
    expect(r.shares[0]?.percent).toBe(0);
    expect(r.shares[1]?.percent).toBe(100);
  });
});
