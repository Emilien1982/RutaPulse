import { formatAscent, groupThousands } from './formatRoute';

describe('groupThousands', () => {
  it.each([
    [999, '999'],
    [1000, '1 000'],
    [1250, '1 250'],
    [12345, '12 345'],
    [1249.6, '1 250'],
  ])('groups %s as %s', (n, expected) => {
    expect(groupThousands(n)).toBe(expected);
  });

  it('formatAscent uses it', () => {
    expect(formatAscent(1250)).toBe('1 250 m');
    expect(formatAscent(421)).toBe('421 m');
  });
});
