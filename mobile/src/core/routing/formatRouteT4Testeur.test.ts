import { formatDistance, formatDuration } from './formatRoute';

describe('formatDistance (maquette 10 : « 25,1 km »)', () => {
  it.each([
    [25.1, '25,1 km'],
    [0, '0 m'],
    [0.999, '999 m'],
    [1, '1,0 km'],
    [99.95, '100,0 km'],
    [12.34, '12,3 km'],
    [0.85, '850 m'],
  ])('%s km -> %s', (km, expected) => {
    expect(formatDistance(km)).toBe(expected);
  });
});

describe('formatDuration (maquette 10 : « 1 h 35 »)', () => {
  it.each([
    [5700, '1 h 35'],
    // Decision of the main session: a minimum of one minute is wanted
    // (a duration of 0 min makes no sense on screen).
    [0, '1 min'],
    [59, '1 min'],
    [3599, '1 h 00'],
    [3600, '1 h 00'],
    [1260, '21 min'],
    [3660, '1 h 01'],
  ])('%s s -> %s', (s, expected) => {
    expect(formatDuration(s)).toBe(expected);
  });
});
