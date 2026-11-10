import { chevronsAlong, chevronsToMapData } from './chevrons';
import { trailsFile } from './testing';
import { parseTrails } from './trails';

// About 111 m per 0.001 degree of latitude.
const EAST: [number, number][] = [
  [6.0, 48.0],
  [6.03, 48.0],
];

describe('chevronsAlong', () => {
  it('puts a point every spacing, the first at half a spacing', () => {
    // 0.03 degree of longitude at 48 N is about 2230 m.
    const points = chevronsAlong(EAST, 500);
    expect(points).toHaveLength(4);
    expect(points[0].at[0]).toBeCloseTo(6.0 + 0.03 * (250 / 2230), 3);
  });

  it('gives the rotation of a text ">" on the map: east 0, south 90, north -90', () => {
    expect(chevronsAlong(EAST, 500)[0].rotate).toBeCloseTo(0, 5);
    expect(
      chevronsAlong(
        [
          [6, 48.01],
          [6, 48],
        ],
        500,
      )[0].rotate,
    ).toBeCloseTo(90, 5);
    expect(
      chevronsAlong(
        [
          [6, 48],
          [6, 48.01],
        ],
        500,
      )[0].rotate,
    ).toBeCloseTo(-90, 5);
    expect(
      chevronsAlong(
        [
          [6.03, 48],
          [6.0, 48],
        ],
        500,
      )[0].rotate,
    ).toBeCloseTo(-180, 5); // west: 180 or -180, the same way
  });

  it('follows the bends: each point takes the direction of its segment', () => {
    const bend: [number, number][] = [
      [6.0, 48.0],
      [6.01, 48.0],
      [6.01, 48.01],
    ];
    const rotations = chevronsAlong(bend, 400).map((c) => Math.round(c.rotate));
    expect(rotations[0]).toBe(0);
    expect(rotations.at(-1)).toBe(-90);
  });

  it('walks the whole circuit: a long line gets many chevrons', () => {
    const long: [number, number][] = Array.from({ length: 300 }, (_, i) => [
      6 + i * 0.001,
      48,
    ]);
    expect(chevronsAlong(long, 150).length).toBeGreaterThan(140);
  });
});

describe('chevronsToMapData', () => {
  const file = trailsFile([
    { osm_id: 1, ordered: EAST, loop: false, ordered_m: 2230, ways: [EAST] },
    { osm_id: 2, ordered: null, refusal: 'parts', ways: [EAST] },
    { osm_id: 3, ways: [EAST] },
  ]);
  const [ordered, refused, old] = parseTrails(file);

  it('has chevrons for an ordered circuit, in every zoom band', () => {
    const bands = new Set(
      chevronsToMapData(ordered).features.map((f) => f.properties.band),
    );
    expect([...bands].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('has none for a refused circuit, an old zone, or nothing chosen', () => {
    expect(chevronsToMapData(refused).features).toEqual([]);
    expect(chevronsToMapData(old).features).toEqual([]);
    expect(chevronsToMapData(null).features).toEqual([]);
  });
});
