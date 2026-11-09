import { heightGroups, joinShapes } from './heightGroups';

describe('heightGroups (ADR 0020 section 6)', () => {
  it('suite vide', () => expect(heightGroups([])).toEqual([]));
  it('tout trace : un groupe', () =>
    expect(
      heightGroups([{ trace: true }, { trace: true }, { trace: true }]),
    ).toEqual([[0, 1, 2]]));
  it('aucun trace : un groupe par troncon', () =>
    expect(heightGroups([{}, {}, { trace: false }])).toEqual([[0], [1], [2]]));
  it('suite mixte : un troncon touche coupe la suite en deux', () => {
    const legs = [
      { trace: true },
      { trace: true },
      {},
      { trace: true },
      {},
      {},
      { trace: true },
      { trace: true },
      { trace: true },
    ];
    expect(heightGroups(legs)).toEqual([[0, 1], [2], [3], [4], [5], [6, 7, 8]]);
  });
  it('joinShapes garde le point de jonction une fois', () => {
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
