// Narrow no-break space (U+202F) before the unit: gap M1 of design/comparaisons/p03-t6.md.
import { formatDistance, formatDuration } from './formatRoute';

describe('formatDistance (maquette 10 : « 25,1 km »)', () => {
  it.each([
    [25.1, '25,1\u202Fkm'],
    [0, '0\u202Fm'],
    [0.999, '999\u202Fm'],
    [1, '1,0\u202Fkm'],
    [99.95, '100,0\u202Fkm'],
    [12.34, '12,3\u202Fkm'],
    [0.85, '850\u202Fm'],
  ])('%s km -> %s', (km, expected) => {
    expect(formatDistance(km)).toBe(expected);
  });
});

describe('formatDuration (maquette 10 : « 1 h 35 »)', () => {
  it.each([
    [5700, '1\u202Fh\u202F35'],
    // Decision of the main session: a minimum of one minute is wanted
    // (a duration of 0 min makes no sense on screen).
    [0, '1\u202Fmin'],
    [59, '1\u202Fmin'],
    [3599, '1\u202Fh\u202F00'],
    [3600, '1\u202Fh\u202F00'],
    [1260, '21\u202Fmin'],
    [3660, '1\u202Fh\u202F01'],
  ])('%s s -> %s', (s, expected) => {
    expect(formatDuration(s)).toBe(expected);
  });
});
