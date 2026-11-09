import { sampleCreated, sampleGpx } from './testing/sampleRoutes';
import { canAttachZone, routeZoneStatus } from './routeZone';
import type { SavedRoute } from './savedRoute';

const zone = {
  id: 'nancy',
  bbox: { lonMin: 6, latMin: 48, lonMax: 7, latMax: 49 },
};
const created = { ...sampleCreated(), id: 1, readable: true } as SavedRoute;
const gpx = (patch = {}) =>
  ({ ...sampleGpx(patch), id: 2, readable: true }) as SavedRoute;
const inside = (id: string) => ({ id });

describe('routeZoneStatus', () => {
  it('usable: the zone of the route is in service', () => {
    expect(routeZoneStatus(created, zone, [inside('nancy')])).toBe('usable');
  });

  it('usable for a created route although a hand leg leaves the rectangle', () => {
    const far = { ...created, zone: { id: 'nancy', version: 1, name: 'N' } };
    expect(routeZoneStatus(far, zone, [inside('nancy')])).toBe('usable');
  });

  it('GPX: usable when the track is inside, leaves when a part is out', () => {
    const track = [
      [6.1, 48.5],
      [6.2, 48.6],
    ];
    const zoned = { id: 'nancy', version: 1, name: 'Nancy' };
    expect(
      routeZoneStatus(gpx({ zone: zoned, track }), zone, [inside('nancy')]),
    ).toBe('usable');
    expect(
      routeZoneStatus(
        gpx({
          zone: zoned,
          track: [
            [6.1, 48.5],
            [7.5, 48.6],
          ],
        }),
        zone,
        [inside('nancy')],
      ),
    ).toBe('leaves');
  });

  it('outside: a GPX without zone', () => {
    expect(routeZoneStatus(gpx(), zone, [inside('nancy')])).toBe('outside');
  });

  it('deleted: the zone is not among the ready zones', () => {
    expect(routeZoneStatus(created, zone, [])).toBe('deleted');
    expect(routeZoneStatus(created, null, [])).toBe('deleted');
  });

  it('notInService: ready, but another zone is in service', () => {
    const metz = { id: 'metz', bbox: zone.bbox };
    expect(
      routeZoneStatus(created, metz, [inside('nancy'), inside('metz')]),
    ).toBe('notInService');
  });
});

describe('canAttachZone', () => {
  it('a GPX without zone whose start is inside takes the zone', () => {
    expect(
      canAttachZone(
        gpx({
          track: [
            [6.5, 48.5],
            [9, 9],
          ],
        }),
        zone,
      ),
    ).toBe(true);
  });

  it('not when the start is outside, the route has a zone, or no zone is in service', () => {
    expect(
      canAttachZone(
        gpx({
          track: [
            [9, 9],
            [6.5, 48.5],
          ],
        }),
        zone,
      ),
    ).toBe(false);
    expect(
      canAttachZone(
        gpx({ zone: { id: 'x', version: 1, name: 'X' }, track: [[6.5, 48.5]] }),
        zone,
      ),
    ).toBe(false);
    expect(canAttachZone(gpx({ track: [[6.5, 48.5]] }), null)).toBe(false);
    expect(canAttachZone(created, zone)).toBe(false);
  });
});
