import { describeRoute, listZoneStatus } from './routeList';
import type { RouteSummary } from './savedRoute';

const local = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).getTime();

function summary(patch: Partial<RouteSummary> = {}): RouteSummary {
  return {
    id: 1,
    name: 'Itinéraire du 3 nov.',
    origin: 'created',
    createdAt: local(2026, 11, 3),
    savedAt: local(2026, 11, 3),
    zoneId: 'nancy',
    zoneName: 'Nancy',
    preview: '',
    distanceKm: 25.1,
    durationS: 5700,
    ascentM: 421,
    descentM: 400,
    figuresAt: null,
    ...patch,
  };
}

describe('listZoneStatus', () => {
  it('tells the zone case from the id alone', () => {
    expect(listZoneStatus(null, 'nancy', ['nancy'])).toBe('outside');
    expect(listZoneStatus('metz', 'nancy', ['nancy'])).toBe('deleted');
    expect(listZoneStatus('nancy', 'nancy', ['nancy'])).toBe('usable');
    expect(listZoneStatus('nancy', null, ['nancy'])).toBe('notInService');
    expect(listZoneStatus('nancy', 'metz', ['nancy', 'metz'])).toBe(
      'notInService',
    );
  });
});

describe('describeRoute', () => {
  it('says figures, zone and origin of a created route', () => {
    const line = describeRoute(summary(), 'usable', 2026);
    expect(line.distance).toBe('25,1 km');
    expect(line.rest).toBe(' · D+ 421\u202Fm · 1\u202Fh\u202F35');
    expect(line.meta).toBe('Zone Nancy · créé le 3 nov.');
    expect(line.problem).toBe(false);
  });

  it('says "modifié le" with the date of the last save', () => {
    const line = describeRoute(
      summary({ savedAt: local(2026, 10, 28) }),
      'usable',
      2026,
    );
    expect(line.meta).toBe('Zone Nancy · modifié le 28 oct.');
  });

  it('says "GPX importé le"', () => {
    const line = describeRoute(summary({ origin: 'gpx' }), 'usable', 2026);
    expect(line.meta).toBe('Zone Nancy · GPX importé le 3 nov.');
  });

  it('adds the year when it is not the current one', () => {
    const old = summary({
      createdAt: local(2025, 11, 3),
      savedAt: local(2025, 11, 3),
    });
    expect(describeRoute(old, 'usable', 2026).meta).toBe(
      'Zone Nancy · créé le 3 nov. 2025',
    );
    expect(describeRoute(old, 'usable', 2025).meta).toBe(
      'Zone Nancy · créé le 3 nov.',
    );
    // "modifié" is dated by the last save, not by the creation.
    const modified = summary({
      createdAt: local(2025, 12, 30),
      savedAt: local(2026, 1, 2),
    });
    expect(describeRoute(modified, 'usable', 2026).meta).toBe(
      'Zone Nancy · modifié le 2 janv.',
    );
  });

  it('shows a dash for a ascent never known', () => {
    const line = describeRoute(summary({ ascentM: null }), 'usable', 2026);
    expect(line.rest).toContain('D+ —');
    expect(line.label).toContain('montée indisponible');
  });

  it('puts the problem in place of the origin', () => {
    const outside = describeRoute(
      summary({ zoneId: null, zoneName: null }),
      'outside',
      2026,
    );
    expect(outside.meta).toBe('Hors de vos zones');
    expect(outside.problem).toBe(true);
    const deleted = describeRoute(
      summary({ zoneName: 'Gérardmer' }),
      'deleted',
      2026,
    );
    expect(deleted.meta).toBe('Zone Gérardmer supprimée');
    expect(deleted.problem).toBe(true);
    expect(deleted.label).toBe(
      'Itinéraire du 3 nov., 25,1\u202Fkm, montée 421\u202Fm, 1\u202Fh\u202F35, Zone Gérardmer supprimée',
    );
  });
});
