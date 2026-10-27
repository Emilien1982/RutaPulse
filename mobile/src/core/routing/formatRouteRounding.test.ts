import { formatDistance } from './formatRoute';

describe('formatDistance rounding at 1 km', () => {
  it('writes 0.9996 km in kilometers, not "1000 m"', () => {
    expect(formatDistance(0.9996)).toBe('1,0 km');
  });

  it('keeps meters just under the limit', () => {
    expect(formatDistance(0.9994)).toBe('999 m');
  });
});
