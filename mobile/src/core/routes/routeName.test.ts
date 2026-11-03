import {
  checkName,
  defaultRouteName,
  normalizeName,
  uniqueDefaultName,
} from './routeName';

describe('normalizeName', () => {
  it('trims and merges spaces and line breaks', () => {
    expect(normalizeName('  Boucle \n\n  du   Bois\t ')).toBe('Boucle du Bois');
  });

  it('removes control characters', () => {
    expect(normalizeName('Bou\u0000cle\u0007')).toBe('Boucle');
    expect(normalizeName('a \u0007 b')).toBe('a b');
  });
});

describe('checkName', () => {
  it('refuses an empty name, also made of spaces or controls', () => {
    for (const raw of ['', '   ', '\n\t', '\u0000']) {
      expect(checkName(raw)).toEqual({ ok: false, reason: 'empty' });
    }
  });

  it('accepts 60 characters and refuses 61', () => {
    expect(checkName('a'.repeat(60))).toEqual({
      ok: true,
      name: 'a'.repeat(60),
    });
    expect(checkName('a'.repeat(61))).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('counts an emoji as one character', () => {
    expect(checkName('😀'.repeat(60)).ok).toBe(true);
    expect(checkName('😀'.repeat(61)).ok).toBe(false);
  });

  it('measures the name after normalization', () => {
    expect(checkName(`  ${'a'.repeat(60)}  `).ok).toBe(true);
  });
});

describe('default name', () => {
  it('is "Itinéraire du 3 nov." from the local date', () => {
    expect(defaultRouteName(new Date(2026, 10, 3, 14, 0))).toBe(
      'Itinéraire du 3 nov.',
    );
    expect(defaultRouteName(new Date(2026, 4, 12))).toBe(
      'Itinéraire du 12 mai',
    );
  });

  it('adds (2), (3)... the smallest free number', () => {
    const base = 'Itinéraire du 3 nov.';
    expect(uniqueDefaultName(base, [])).toBe(base);
    expect(uniqueDefaultName(base, ['Autre'])).toBe(base);
    expect(uniqueDefaultName(base, [base])).toBe(`${base} (2)`);
    expect(uniqueDefaultName(base, [base, `${base} (2)`])).toBe(`${base} (3)`);
    expect(uniqueDefaultName(base, [base, `${base} (3)`])).toBe(`${base} (2)`);
    expect(uniqueDefaultName(base, [`${base} (2)`])).toBe(base);
  });
});
