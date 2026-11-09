// Tester tests, written from the spec (phase 7, C4/C5, mockup 12 "B. Circuit
// sans nom" and "Règles d'affichage"), not from the code.

import { mapLabel, parseTrails, trailsToMapData } from './trails';
import { trailSummary, trailTitle } from './trailSummary';
import { trailsFile } from './testing';

const LINE: [number, number][] = [
  [6.0, 48.0],
  [6.0, 48.01],
];

function one(feature: Parameters<typeof trailsFile>[0][number]) {
  return parseTrails(trailsFile([{ ways: [LINE], ...feature }]))[0];
}

describe('circuit title (mockup 12, B)', () => {
  it('uses the name when there is one', () => {
    expect(trailTitle(one({ osm_id: 1, name: 'Haye', ref: '7' }))).toBe('Haye');
  });
  it('uses "Circuit 7" when the name is absent but the ref exists', () => {
    expect(trailTitle(one({ osm_id: 1, ref: '7' }))).toBe('Circuit 7');
  });
  it('uses "Circuit sans nom" with neither name nor ref', () => {
    expect(trailTitle(one({ osm_id: 1 }))).toBe('Circuit sans nom');
  });
  it('treats an empty or blank name as absent', () => {
    expect(trailTitle(one({ osm_id: 1, name: '  ', ref: '12' }))).toBe(
      'Circuit 12',
    );
  });
});

describe('label along the line (mockup 12, B)', () => {
  it('is the name, else "Circuit {ref}", else empty (no label)', () => {
    expect(mapLabel(one({ osm_id: 1, name: 'Haye' }))).toBe('Haye');
    expect(mapLabel(one({ osm_id: 1, ref: '7' }))).toBe('Circuit 7');
    expect(mapLabel(one({ osm_id: 1 }))).toBe('');
  });
  it('is carried by the light copy of every circuit', () => {
    const trails = [
      one({ osm_id: 1, name: 'A' }),
      one({ osm_id: 2, ref: '3' }),
      one({ osm_id: 3 }),
    ];
    const labels = trailsToMapData(trails).features.map(
      (f) => f.properties.label,
    );
    expect(labels).toEqual(['A', 'Circuit 3', '']);
  });
});

// Spaces before "km" and around "·" may be non-breaking: compare on plain spaces.
const plain = (x: string) => x.replace(/[\u202F\u00A0]/g, ' ');

describe('summary line (C5)', () => {
  it('ordered loop: 34 904 m reads 34,9 km, boucle', () => {
    const t = one({
      osm_id: 1,
      ordered: LINE,
      loop: true,
      ordered_m: 34904,
      removed_m: 0,
    });
    expect(plain(trailSummary(t))).toBe('34,9 km · boucle');
  });
  it('one way', () => {
    const t = one({
      osm_id: 1,
      ordered: LINE,
      loop: false,
      ordered_m: 18600,
      removed_m: 0,
    });
    expect(plain(trailSummary(t))).toBe('18,6 km · aller simple');
  });
  it('refused or old: "environ N km" from length_m, rounded to the km', () => {
    expect(plain(trailSummary(one({ osm_id: 1, length_m: 22500 })))).toMatch(
      /^environ 2[23] km$/,
    );
    expect(
      plain(trailSummary(one({ osm_id: 1, length_m: 12400, ordered: null }))),
    ).toBe('environ 12 km');
  });
});
