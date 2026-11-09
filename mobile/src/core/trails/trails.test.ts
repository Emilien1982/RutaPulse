import { nancyTrails, trailsFile } from './testing';
import { parseTrails, sortByDistance, trailsToMapData } from './trails';

const LINE: [number, number][] = [
  [6.0, 48.0],
  [6.01, 48.0],
];

describe('parseTrails', () => {
  it('reads the two circuits of Nancy with their ordered line', () => {
    const trails = nancyTrails();
    expect(trails.map((t) => t.osmId)).toEqual([11656724, 15712020]);
    const [noName, named] = trails;
    expect(noName.name).toBeUndefined();
    expect(named.name).toBe('Petite Suisse Lorraine à VTT');
    expect(noName.line).toMatchObject({
      kind: 'ordered',
      loop: true,
      orderedM: 21326,
      removedM: 0,
    });
    expect(named.line.kind === 'ordered' && named.line.ordered).toHaveLength(
      1292,
    );
  });

  it('takes a missing `ordered` key as an old zone', () => {
    const [trail] = parseTrails(
      trailsFile([{ osm_id: 1, length_m: 5000, ways: [LINE] }]),
    );
    expect(trail.line).toEqual({ kind: 'old' });
    expect(trail.lengthM).toBe(5000);
  });

  it('takes `ordered: null` as a refusal, with its reason', () => {
    const file = trailsFile([
      { osm_id: 1, ordered: null, refusal: 'parts', ways: [LINE] },
      { osm_id: 2, ordered: null, refusal: 'removedTooMuch', ways: [LINE] },
      { osm_id: 3, ordered: null, refusal: 'branches', ways: [LINE] },
    ]);
    expect(parseTrails(file).map((t) => t.line)).toEqual([
      { kind: 'refused', reason: 'parts' },
      { kind: 'refused', reason: 'removedTooMuch' },
      { kind: 'refused', reason: 'branches' },
    ]);
  });

  it('takes a wrong ordered line as a refusal', () => {
    const file = trailsFile([
      { osm_id: 1, ordered: [[6, 48]], ways: [LINE] },
      {
        osm_id: 2,
        ordered: [
          [6, 48],
          [200, 48],
        ],
        ways: [LINE],
      },
    ]);
    expect(parseTrails(file).map((t) => t.line.kind)).toEqual([
      'refused',
      'refused',
    ]);
  });

  it('keeps name, ref and colour optional', () => {
    const [trail] = parseTrails(
      trailsFile([{ osm_id: 1, ref: ' 7 ', ordered: null, ways: [LINE] }]),
    );
    expect(trail).toMatchObject({ ref: '7', name: undefined });
    expect(trail.colour).toBeUndefined();
  });

  it('gives an empty list for an unreadable file, and never throws', () => {
    expect(parseTrails(null)).toEqual([]);
    expect(parseTrails('not json')).toEqual([]);
    expect(parseTrails('{"features": 3}')).toEqual([]);
    expect(parseTrails('{"features": [null, {"properties": {}}]}')).toEqual([]);
  });
});

describe('trailsToMapData', () => {
  it('is a light copy: raw ways and a label, no ordered line', () => {
    const file = trailsFile([
      { osm_id: 1, name: 'Tour', ordered: LINE, loop: false, ways: [LINE] },
      { osm_id: 2, ref: '7', ordered: null, ways: [LINE] },
      { osm_id: 3, ordered: null, ways: [LINE] },
    ]);
    const data = trailsToMapData(parseTrails(file));
    expect(data.features.map((f) => f.properties)).toEqual([
      { osm_id: 1, label: 'Tour' },
      { osm_id: 2, label: 'Circuit 7' },
      { osm_id: 3, label: '' },
    ]);
    expect(JSON.stringify(data)).not.toContain('ordered');
    expect(data.features[0].geometry.coordinates).toEqual([LINE]);
  });
});

describe('sortByDistance', () => {
  const a: [number, number][] = [
    [6.0, 48.0],
    [6.01, 48.0],
  ];
  const b: [number, number][] = [
    [6.0, 48.001],
    [6.01, 48.001],
  ];
  const trails = parseTrails(
    trailsFile([
      { osm_id: 20, ordered: null, ways: [b] },
      { osm_id: 10, ordered: null, ways: [a] },
    ]),
  );

  it('puts the line nearest to the point first', () => {
    expect(
      sortByDistance(trails, [6.005, 48.0009]).map((t) => t.osmId),
    ).toEqual([20, 10]);
    expect(
      sortByDistance(trails, [6.005, 48.0001]).map((t) => t.osmId),
    ).toEqual([10, 20]);
  });

  it('puts the smallest osm_id first when the circuits share a path', () => {
    const shared = parseTrails(
      trailsFile([
        { osm_id: 20, ordered: null, ways: [a] },
        { osm_id: 10, ordered: null, ways: [a] },
      ]),
    );
    expect(
      sortByDistance(shared, [6.005, 48.0005]).map((t) => t.osmId),
    ).toEqual([10, 20]);
  });

  it('measures to the nearest of the ways of a circuit', () => {
    const far: [number, number][] = [
      [6.05, 48.0],
      [6.06, 48.0],
    ];
    const two = parseTrails(
      trailsFile([
        { osm_id: 1, ordered: null, ways: [far, b] },
        { osm_id: 2, ordered: null, ways: [a] },
      ]),
    );
    expect(sortByDistance(two, [6.005, 48.0009]).map((t) => t.osmId)).toEqual([
      1, 2,
    ]);
  });
});
