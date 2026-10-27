// Tester tests, written from the spec (C4) and ADR 0015 section 1.
import { buildRouteRequest } from './routeRequest';

const P = (lat: number, lon: number) => ({ lat, lon });

function parse(points: { lat: number; lon: number }[]): any {
  return JSON.parse(buildRouteRequest(points));
}

describe('buildRouteRequest (C4)', () => {
  it.each([2, 3, 5])('applies the ADR 0002 setting with %i points', (n) => {
    const points = Array.from({ length: n }, (_, i) =>
      P(48.66 + i * 0.01, 6.1 + i * 0.01),
    );
    const req = parse(points);
    expect(req.costing).toBe('bicycle');
    expect(req.costing_options.bicycle.bicycle_type).toBe('mountain');
    expect(req.costing_options.bicycle.use_roads).toBe(0);
    expect(req.directions_options.language).toBe('fr-FR');
    expect(req.directions_options.units).toBe('kilometers');
    expect(req.locations).toHaveLength(n);
  });

  it('2 points: both are break', () => {
    const req = parse([P(48.66, 6.1), P(48.68, 6.14)]);
    expect(req.locations.map((l: any) => l.type)).toEqual(['break', 'break']);
  });

  it('3 points: break, through, break', () => {
    const req = parse([P(48.66, 6.1), P(48.67, 6.12), P(48.68, 6.14)]);
    expect(req.locations.map((l: any) => l.type)).toEqual([
      'break',
      'through',
      'break',
    ]);
  });

  it('5 points: break, 3 through, break', () => {
    const req = parse([1, 2, 3, 4, 5].map((i) => P(48 + i / 100, 6 + i / 100)));
    expect(req.locations.map((l: any) => l.type)).toEqual([
      'break',
      'through',
      'through',
      'through',
      'break',
    ]);
  });

  it('keeps lat/lon in order and unchanged', () => {
    const req = parse([P(48.6612, 6.1015), P(48.6846, 6.1408)]);
    expect(req.locations[0]).toMatchObject({ lat: 48.6612, lon: 6.1015 });
    expect(req.locations[1]).toMatchObject({ lat: 48.6846, lon: 6.1408 });
  });

  it('returns JSON text', () => {
    expect(typeof buildRouteRequest([P(48, 6), P(48.1, 6.1)])).toBe('string');
  });
});
