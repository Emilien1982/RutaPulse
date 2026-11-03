import { rowToRoute, routeToRow, type RouteRow } from './savedRoute';
import { sampleCreated, sampleGpx } from './testing/sampleRoutes';

const rowOf = (route: Parameters<typeof routeToRow>[0]): RouteRow => ({
  id: 7,
  ...(routeToRow(route) as Omit<RouteRow, 'id'>),
});

describe('rowToRoute', () => {
  it('reads back a created route as it was written', () => {
    const route = sampleCreated();
    const read = rowToRoute(rowOf(route));
    expect(read.readable && read.origin === 'created').toBe(true);
    // The shapes go through a 6-decimal polyline: these values are exact.
    expect(read).toEqual({ ...route, id: 7, readable: true });
  });

  it('writes no `linked` when it is empty', () => {
    const route = sampleCreated();
    route.draft = { ...route.draft, linked: [] };
    const row = rowOf(route);
    expect(JSON.parse(row.draft!)).not.toHaveProperty('linked');
  });

  it('reads back a GPX route, with and without altitudes', () => {
    const route = sampleGpx();
    expect(rowToRoute(rowOf(route))).toEqual({
      ...route,
      id: 7,
      readable: true,
    });
    const flat = sampleGpx({ elevations: null, zone: null });
    expect(rowToRoute(rowOf(flat))).toEqual({ ...flat, id: 7, readable: true });
  });

  it('keeps the zone of a GPX route', () => {
    const zone = { id: 'nancy', version: 5, name: 'Nancy' };
    const route = rowToRoute(rowOf(sampleGpx({ zone })));
    expect(route.zone).toEqual(zone);
  });

  describe('gives an unreadable route, never an error', () => {
    const good = rowOf(sampleCreated());
    const goodGpx = rowOf(sampleGpx());
    const cases: [string, Partial<RouteRow>][] = [
      ['draft is not JSON', { draft: '{nope' }],
      ['draft is null', { draft: null }],
      ['draft is an array', { draft: '[]' }],
      [
        'a latitude is out of range',
        {
          draft: JSON.stringify({
            points: [
              { id: 1, lon: 6, lat: 91 },
              { id: 2, lon: 6, lat: 48 },
            ],
            modes: ['path'],
          }),
        },
      ],
      [
        'a longitude is not a number',
        {
          draft: JSON.stringify({
            points: [
              { id: 1, lon: '6', lat: 48 },
              { id: 2, lon: 6, lat: 48 },
            ],
            modes: ['path'],
          }),
        },
      ],
      [
        'point ids are repeated',
        {
          draft: JSON.stringify({
            points: [
              { id: 1, lon: 6, lat: 48 },
              { id: 1, lon: 6, lat: 48 },
            ],
            modes: ['path'],
          }),
        },
      ],
      [
        'there are as many modes as points',
        {
          draft: JSON.stringify({
            points: [
              { id: 1, lon: 6, lat: 48 },
              { id: 2, lon: 6, lat: 48 },
            ],
            modes: ['path', 'path'],
          }),
        },
      ],
      [
        'linked names an unknown point',
        {
          draft: JSON.stringify({
            points: [
              { id: 1, lon: 6, lat: 48 },
              { id: 2, lon: 6, lat: 48 },
            ],
            modes: ['path'],
            linked: [9],
          }),
        },
      ],
      ['legs is not JSON', { legs: 'x' }],
      ['legs is too short', { legs: '[]' }],
      [
        'a leg has another mode',
        { legs: JSON.stringify([{ mode: 'hand' }, { mode: 'hand' }]) },
      ],
      [
        'a leg shape has one point',
        {
          legs: JSON.stringify([
            {
              mode: 'path',
              zoneVersion: 5,
              distanceKm: 1,
              durationS: 1,
              shape: '_p~iF~ps|U',
            },
            { mode: 'hand' },
          ]),
        },
      ],
      [
        'a created route has no zone',
        { zone_id: null, zone_version: null, zone_name: null },
      ],
      ['zone version is missing', { zone_version: null }],
    ];
    it.each(cases)('when %s', (_name, patch) => {
      const read = rowToRoute({ ...good, ...patch });
      expect(read.readable).toBe(false);
      expect(read.id).toBe(7);
      expect(read.name).toBe(good.name);
      expect(read.distanceKm).toBe(good.distance_km);
    });

    it.each([
      ['track is null', { track: null }],
      ['track has one point', { track: '_p~iF~ps|U' }],
      ['elevations do not match the track', { elevations: '[1, 2]' }],
      ['elevations is not JSON', { elevations: 'x' }],
      ['elevations hold a string', { elevations: '[1, "a", 2]' }],
    ] as [string, Partial<RouteRow>][])('GPX: when %s', (_name, patch) => {
      expect(rowToRoute({ ...goodGpx, ...patch }).readable).toBe(false);
    });
  });
});
