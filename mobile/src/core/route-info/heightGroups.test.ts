import { heightGroupKey, heightGroups, joinShapes } from './heightGroups';

const T = { trace: true };
const N = {};

describe('heightGroups (ADR 0020, section 6)', () => {
  it('a run of untouched trace legs is one group', () => {
    expect(heightGroups([T, T, T])).toEqual([[0, 1, 2]]);
  });

  it('a touched leg cuts the run in two and is a group of its own', () => {
    expect(heightGroups([T, T, N, T, T, T])).toEqual([[0, 1], [2], [3, 4, 5]]);
  });

  it('other legs are one group each', () => {
    expect(heightGroups([N, N, T, N])).toEqual([[0], [1], [2], [3]]);
  });

  it('two touched legs in a row stay apart', () => {
    expect(heightGroups([T, N, N, T])).toEqual([[0], [1], [2], [3]]);
  });

  it('no legs, no groups', () => {
    expect(heightGroups([])).toEqual([]);
  });
});

describe('joinShapes', () => {
  it('writes the junction point once', () => {
    expect(
      joinShapes([
        [
          [0, 0],
          [1, 1],
        ],
        [
          [1, 1],
          [2, 2],
        ],
      ]),
    ).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });
});

describe('heightGroupKey', () => {
  const zone = { id: 'nancy', version: 6 };
  const points = [
    { lon: 6, lat: 48 },
    { lon: 6.1, lat: 48.1 },
  ];

  it('holds the zone, the points in order and trace:N', () => {
    expect(heightGroupKey(zone, points, 6)).toEqual([
      'routing',
      'height',
      'nancy',
      6,
      6,
      48,
      6.1,
      48.1,
      'trace:6',
    ]);
  });

  it('depends on the version of the zone that held the trace', () => {
    expect(heightGroupKey(zone, points, 6)).not.toEqual(
      heightGroupKey(zone, points, 5),
    );
  });
});
