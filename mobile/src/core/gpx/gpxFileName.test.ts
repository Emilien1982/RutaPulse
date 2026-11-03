import { gpxFileName } from './gpxFileName';

describe('gpxFileName', () => {
  it('adds .gpx and keeps accents and spaces', () => {
    expect(gpxFileName('Boucle du Bois de la Côte')).toBe(
      'Boucle du Bois de la Côte.gpx',
    );
  });

  it('replaces the forbidden characters by "-"', () => {
    expect(gpxFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j.gpx');
    expect(gpxFileName('a\u0000b\nc')).toBe('a-b-c.gpx');
  });

  it('normalizes the spaces', () => {
    expect(gpxFileName('  a   b  ')).toBe('a b.gpx');
  });

  it('gives itineraire.gpx for an empty name', () => {
    expect(gpxFileName('')).toBe('itineraire.gpx');
    expect(gpxFileName('   ')).toBe('itineraire.gpx');
  });
});
