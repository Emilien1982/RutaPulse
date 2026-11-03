import { trackLengthM } from '../gpx/trackLengthM';
import type { Zone } from '../zones/catalogue';
import { buildImportedRoute } from './importedRoute';

const NANCY: Zone = {
  id: 'nancy',
  name: 'Nancy',
  version: 5,
  bbox: { lonMin: 5.9, lonMax: 6.5, latMin: 48.5, latMax: 48.9 },
  osmDate: '2026-10-01',
  totalBytes: 1,
  files: [],
};

const TRACK: [number, number][] = [
  [6.18, 48.69],
  [6.19, 48.7],
  [6.2, 48.71],
];
const gpx = (patch: object = {}) => ({
  ok: true as const,
  name: 'Rando',
  track: TRACK,
  elevations: [200, null, 210] as (number | null)[],
  ...patch,
});

describe('buildImportedRoute', () => {
  it('keeps the name of the GPX, else the name of the file without .gpx', () => {
    expect(buildImportedRoute(gpx(), 'f.gpx', NANCY, 5).name).toBe('Rando');
    const fromFile = buildImportedRoute(
      gpx({ name: '' }),
      '  Sortie   du  matin.GPX ',
      NANCY,
      5,
    );
    expect(fromFile.name).toBe('Sortie du matin');
  });

  it('cuts the name of the file to 60 characters', () => {
    const route = buildImportedRoute(
      gpx({ name: '' }),
      `${'é'.repeat(80)}.gpx`,
      NANCY,
      5,
    );
    expect([...(route.name ?? '')]).toHaveLength(60);
  });

  it('gives no name when both are empty (the caller takes the default)', () => {
    expect(
      buildImportedRoute(gpx({ name: '' }), '.gpx', NANCY, 5),
    ).not.toHaveProperty('name');
  });

  it('measures the distance on the track and the duration at 10 km/h', () => {
    const route = buildImportedRoute(gpx(), 'f.gpx', NANCY, 5);
    expect(route.distanceKm).toBeCloseTo(trackLengthM(TRACK) / 1000, 9);
    expect(route.durationS).toBe(Math.round((route.distanceKm / 10) * 3600));
    expect(route.ascentM).toBeNull();
    expect(route.descentM).toBeNull();
    expect(route.figuresAt).toBeNull();
  });

  it('takes the zone in service when it holds the start', () => {
    const route = buildImportedRoute(gpx(), 'f.gpx', NANCY, 5);
    expect(route.zone).toEqual({ id: 'nancy', version: 5, name: 'Nancy' });
    expect(route.origin).toBe('gpx');
    expect(route.createdAt).toBe(5);
    expect(route.savedAt).toBe(5);
  });

  it('has no zone when the start is outside or no zone is in service', () => {
    const far = gpx({
      track: [
        [2, 40],
        [2.1, 40.1],
      ],
      elevations: [null, null],
    });
    expect(buildImportedRoute(far, 'f.gpx', NANCY, 5).zone).toBeNull();
    expect(buildImportedRoute(gpx(), 'f.gpx', null, 5).zone).toBeNull();
  });

  it('keeps the altitudes, or null when none is known', () => {
    expect(buildImportedRoute(gpx(), 'f.gpx', NANCY, 5).elevations).toEqual([
      200,
      null,
      210,
    ]);
    const none = gpx({ elevations: [null, null, null] });
    expect(buildImportedRoute(none, 'f.gpx', NANCY, 5).elevations).toBeNull();
  });
});
