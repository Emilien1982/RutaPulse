import { nancyTrails, trailsFile } from './testing';
import { trailSummary, trailTitle } from './trailSummary';
import { parseTrails } from './trails';

const LINE: [number, number][] = [
  [6.0, 48.0],
  [6.01, 48.0],
];

describe('trailTitle', () => {
  it('takes the name, else the number, else "Circuit sans nom"', () => {
    const trails = parseTrails(
      trailsFile([
        { osm_id: 1, name: 'Tour', ordered: null, ways: [LINE] },
        { osm_id: 2, ref: '7', ordered: null, ways: [LINE] },
        { osm_id: 3, ordered: null, ways: [LINE] },
      ]),
    );
    expect(trails.map(trailTitle)).toEqual([
      'Tour',
      'Circuit 7',
      'Circuit sans nom',
    ]);
  });
});

describe('trailSummary', () => {
  it('writes the length of the ordered line and loop or one way', () => {
    const [noName, named] = nancyTrails();
    expect(trailSummary(noName)).toBe('21,3 km · boucle');
    expect(trailSummary(named)).toBe('34,9 km · boucle');
    const [oneWay] = parseTrails(
      trailsFile([
        {
          osm_id: 1,
          ordered: LINE,
          loop: false,
          ordered_m: 18600,
          ways: [LINE],
        },
      ]),
    );
    expect(trailSummary(oneWay)).toBe('18,6 km · aller simple');
  });

  it('writes "environ N km" without an ordered line', () => {
    const [old, refused] = parseTrails(
      trailsFile([
        { osm_id: 1, length_m: 35040, ways: [LINE] },
        { osm_id: 2, length_m: 22400, ordered: null, ways: [LINE] },
      ]),
    );
    expect(trailSummary(old)).toBe('environ 35 km');
    expect(trailSummary(refused)).toBe('environ 22 km');
  });
});
