import { formatRouteDate, originText, zoneLine } from './routeText';

const nov3 = new Date(2026, 10, 3, 10).getTime();
const nov5 = new Date(2026, 10, 5, 10).getTime();

describe('routeText', () => {
  it('formats a date with or without the year', () => {
    expect(formatRouteDate(nov3, false)).toBe('3 nov.');
    expect(formatRouteDate(nov3, true)).toBe('3 nov. 2026');
  });

  it('says created, modified or imported', () => {
    const base = { createdAt: nov3, savedAt: nov3 };
    expect(originText({ ...base, origin: 'created' }, true)).toBe(
      'créé le 3 nov. 2026',
    );
    expect(
      originText({ origin: 'created', createdAt: nov3, savedAt: nov5 }, false),
    ).toBe('modifié le 5 nov.');
    expect(originText({ ...base, origin: 'gpx' }, false)).toBe(
      'GPX importé le 3 nov.',
    );
  });

  it('writes the line under the title', () => {
    const route = {
      origin: 'created' as const,
      createdAt: nov3,
      savedAt: nov3,
      zone: { name: 'Nancy' },
    };
    expect(zoneLine(route, 'usable')).toBe('Zone Nancy · créé le 3 nov. 2026');
    expect(zoneLine(route, 'deleted')).toBe(
      'Zone Nancy supprimée · créé le 3 nov. 2026',
    );
    expect(zoneLine({ ...route, origin: 'gpx', zone: null }, 'outside')).toBe(
      'Hors de vos zones · GPX importé le 3 nov. 2026',
    );
  });
});
