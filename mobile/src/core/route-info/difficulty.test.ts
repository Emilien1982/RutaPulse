import { parseDifficultyTable, summarizeDifficulty } from './difficulty';
import type { LegInfo } from './routeInfo';

const table = (lists: unknown[][]) =>
  JSON.stringify({ formatVersion: 1, waysByLevel: lists });
const seven = (first: unknown[][]) => [
  ...first,
  ...Array.from({ length: 7 - first.length }, () => []),
];

describe('parseDifficultyTable', () => {
  it('reads a valid table', () => {
    const t = parseDifficultyTable(table(seven([[5], [10, 11], [], [20]])));
    expect(t.get(5)).toBe(0);
    expect(t.get(11)).toBe(1);
    expect(t.get(20)).toBe(3);
    expect(t.get(99)).toBeUndefined();
  });

  it.each([
    ['absent', null],
    ['not JSON', '{oops'],
    ['not an object', '3'],
    [
      'formatVersion 2',
      JSON.stringify({ formatVersion: 2, waysByLevel: seven([]) }),
    ],
    ['6 lists', table([[], [], [], [], [], []])],
    ['duplicate id', table(seven([[5], [5]]))],
    ['id 0', table(seven([[0]]))],
    ['decimal id', table(seven([[1.5]]))],
    [
      'text id',
      JSON.stringify({ formatVersion: 1, waysByLevel: seven([['a']]) }),
    ],
  ])('gives an empty table: %s', (_name, text) => {
    expect(parseDifficultyTable(text as string | null).size).toBe(0);
  });
});

const T = parseDifficultyTable(table(seven([[1], [2], [3], [], [], [], [7]])));
const path = (...edges: { wayId?: number; lengthKm: number }[]): LegInfo => ({
  mode: 'path',
  handKm: 0,
  height: undefined,
  terrain: {
    ok: true,
    edges: edges.map((e) => ({ use: 'path', density: 1, ...e })),
  },
});
const hand = (km: number): LegInfo => ({
  mode: 'hand',
  handKm: km,
  height: undefined,
  terrain: undefined,
});
const ready = (legs: LegInfo[], t = T) => {
  const r = summarizeDifficulty(legs, t);
  if (r.status !== 'ready') throw new Error(r.status);
  return r.shares.map((s) => [s.part, s.percent]);
};

describe('summarizeDifficulty', () => {
  it('is all unknown with an empty table', () => {
    expect(
      ready([path({ wayId: 1, lengthKm: 2 })], parseDifficultyTable(null)),
    ).toEqual([['unknown', 100]]);
  });

  it('mixes levels, ordered by length, then unknown', () => {
    expect(
      ready([
        path(
          { wayId: 2, lengthKm: 1 },
          { wayId: 3, lengthKm: 3 },
          { wayId: 1, lengthKm: 2 },
          { lengthKm: 4 },
        ),
      ]),
    ).toEqual([
      [2, 30],
      [0, 20],
      [1, 10],
      ['unknown', 40],
    ]);
  });

  it('counts a hand leg as unknown', () => {
    expect(ready([path({ wayId: 1, lengthKm: 3 }), hand(1)])).toEqual([
      [0, 75],
      ['unknown', 25],
    ]);
  });

  it('counts a way absent from the table as unknown', () => {
    expect(ready([path({ wayId: 999, lengthKm: 1 })])).toEqual([
      ['unknown', 100],
    ]);
  });

  it('sums to 100 with 3 equal parts', () => {
    const shares = ready([
      path(
        { wayId: 1, lengthKm: 1 },
        { wayId: 2, lengthKm: 1 },
        { wayId: 3, lengthKm: 1 },
      ),
    ]);
    expect(shares.reduce((s, x) => s + (x[1] as number), 0)).toBe(100);
  });

  it('breaks a tie of length with the lower level first', () => {
    expect(
      ready([path({ wayId: 3, lengthKm: 1 }, { wayId: 1, lengthKm: 1 })]).map(
        (x) => x[0],
      ),
    ).toEqual([0, 2]);
  });

  it('sorts on exact lengths and keeps a tiny part at 0 %', () => {
    const r = summarizeDifficulty(
      [path({ wayId: 1, lengthKm: 0.001 }, { lengthKm: 10 })],
      T,
    );
    expect(r.status === 'ready' && r.shares).toEqual([
      { part: 0, km: 0.001, percent: 0 },
      { part: 'unknown', km: 10, percent: 100 },
    ]);
  });

  it('is pending without the table or with a terrain not yet there', () => {
    expect(summarizeDifficulty([path({ lengthKm: 1 })], undefined).status).toBe(
      'pending',
    );
    const waiting: LegInfo = { ...path(), terrain: undefined };
    expect(summarizeDifficulty([waiting], T).status).toBe('pending');
  });

  it('is missing when the terrain is missing', () => {
    const broken: LegInfo = {
      ...path(),
      terrain: { ok: false, error: 'failed' } as LegInfo['terrain'],
    };
    expect(summarizeDifficulty([broken], T).status).toBe('missing');
    expect(summarizeDifficulty([broken], undefined).status).toBe('missing');
    expect(summarizeDifficulty([], T).status).toBe('missing');
  });
});
