// Origins `trail` and `editedGpx`, the `trace` marker, texts and names
// (ADR 0020, sections 4 and 7; spec C9).

import { describeRoute } from './routeList';
import { trailRouteName, uniqueDefaultName } from './routeName';
import { originText } from './routeText';
import { reopenDraft } from './reopen';
import {
  legsToJson,
  rowToRoute,
  routeToRow,
  type CreatedRoute,
  type RouteRow,
  type RouteSummary,
} from './savedRoute';
import { sampleCreated } from './testing/sampleRoutes';

const nov3 = new Date(2026, 10, 3, 10).getTime();
const nov5 = new Date(2026, 10, 5, 10).getTime();

const rowOf = (patch: Partial<RouteRow> = {}): RouteRow =>
  ({ id: 1, ...routeToRow(sampleCreated()), ...patch }) as RouteRow;

describe('texts of the new origins', () => {
  it('trail: "circuit balisé" until saved again, then "circuit modifié"', () => {
    expect(
      originText({ origin: 'trail', createdAt: nov3, savedAt: nov3 }, false),
    ).toBe('circuit balisé, le 3 nov.');
    expect(
      originText({ origin: 'trail', createdAt: nov3, savedAt: nov5 }, true),
    ).toBe('circuit modifié le 5 nov. 2026');
  });

  it('editedGpx: "GPX modifié le" the date of the last save', () => {
    expect(
      originText(
        { origin: 'editedGpx', createdAt: nov3, savedAt: nov5 },
        false,
      ),
    ).toBe('GPX modifié le 5 nov.');
  });

  it('the list shows the year from the date the text uses', () => {
    const summary = (patch: Partial<RouteSummary>): RouteSummary => ({
      id: 1,
      name: 'n',
      origin: 'trail',
      createdAt: new Date(2025, 11, 30).getTime(),
      savedAt: new Date(2025, 11, 30).getTime(),
      zoneId: 'z',
      zoneName: 'Z',
      preview: '',
      distanceKm: 1,
      durationS: 60,
      ascentM: null,
      descentM: null,
      figuresAt: null,
      ...patch,
    });
    const meta = (r: RouteSummary) => describeRoute(r, 'usable', 2026).meta;
    expect(meta(summary({}))).toBe('Zone Z · circuit balisé, le 30 déc. 2025');
    expect(meta(summary({ savedAt: nov5 }))).toBe(
      'Zone Z · circuit modifié le 5 nov.',
    );
    expect(meta(summary({ origin: 'editedGpx', savedAt: nov5 }))).toBe(
      'Zone Z · GPX modifié le 5 nov.',
    );
  });
});

describe('the new origins and `trace` in a row', () => {
  it.each(['trail', 'editedGpx'] as const)('reads a %s row', (origin) => {
    const route = rowToRoute(rowOf({ origin }));
    expect(route).toMatchObject({ origin, readable: true });
  });

  it('writes and reads back `trace: true`', () => {
    const base = sampleCreated({ origin: 'trail' });
    const legs = base.legs.map((l) =>
      l.mode === 'path' ? { ...l, trace: true as const } : l,
    );
    const row = rowOf({ origin: 'trail', legs: legsToJson(legs) });
    expect(JSON.parse(row.legs!)[0].trace).toBe(true);
    expect((rowToRoute(row) as CreatedRoute).legs).toEqual(legs);
    // no marker: nothing written
    expect(JSON.parse(legsToJson(base.legs))[0]).not.toHaveProperty('trace');
  });

  it.each([false, 1, 'true', null])('refuses `trace: %p`', (value) => {
    const legs = JSON.parse(rowOf().legs!);
    legs[0].trace = value;
    const route = rowToRoute(rowOf({ legs: JSON.stringify(legs) }));
    expect(route.readable).toBe(false);
  });

  it('reopenDraft keeps the marker on the kept leg', () => {
    const base = sampleCreated({ origin: 'trail' });
    const legs = base.legs.map((l) =>
      l.mode === 'path' ? { ...l, trace: true as const } : l,
    );
    const { kept } = reopenDraft({
      ...base,
      legs,
      id: 1,
      readable: true,
    } as CreatedRoute);
    expect([...kept.values()].map((k) => k.trace)).toEqual([true]);
    const plain = reopenDraft({
      ...base,
      id: 1,
      readable: true,
    } as CreatedRoute);
    expect([...plain.kept.values()][0]).not.toHaveProperty('trace');
  });
});

describe('trailRouteName', () => {
  const day = new Date(2026, 10, 9);
  it('takes the name, else the number, else the date', () => {
    expect(trailRouteName({ name: 'Boucle du Haut', ref: '3' }, day)).toBe(
      'Boucle du Haut',
    );
    expect(trailRouteName({ ref: '3' }, day)).toBe('Circuit 3');
    expect(trailRouteName({ name: '  ' }, day)).toBe('Circuit du 9 nov.');
    expect(trailRouteName({}, day)).toBe('Circuit du 9 nov.');
  });

  it('adds (2) when the name exists, and is cut to 60 characters', () => {
    const name = trailRouteName({}, day);
    expect(uniqueDefaultName(name, ['Circuit du 9 nov.'])).toBe(
      'Circuit du 9 nov. (2)',
    );
    expect([...trailRouteName({ name: 'é'.repeat(80) }, day)]).toHaveLength(60);
  });

  it('a taken 60-character name gives exactly 60 ending with (2)', () => {
    const name = trailRouteName({ name: 'é'.repeat(70) }, day);
    expect([...name]).toHaveLength(60);
    const second = uniqueDefaultName(name, [name]);
    expect([...second]).toHaveLength(60);
    expect(second.endsWith(' (2)')).toBe(true);
    expect(uniqueDefaultName(name, [name, second]).endsWith(' (3)')).toBe(true);
  });
});
