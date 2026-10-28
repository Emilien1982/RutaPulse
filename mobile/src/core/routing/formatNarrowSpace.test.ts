import { formatDistance, formatDuration } from './formatRoute';

// Mockup tokens: a narrow no-break space (U+202F) before the unit, so that
// the number and its unit are never split over two lines.
describe('narrow space before the unit', () => {
  it('is used in kilometers, meters, minutes and hours', () => {
    expect(formatDistance(25.1)).toBe('25,1 km');
    expect(formatDistance(0.85)).toBe('850 m');
    expect(formatDuration(21 * 60)).toBe('21 min');
    expect(formatDuration(95 * 60)).toBe('1 h 35');
  });

  it('never uses a plain space inside a figure', () => {
    for (const text of [
      formatDistance(3.2),
      formatDistance(0.5),
      formatDuration(30),
      formatDuration(7200),
    ]) {
      expect(text).not.toContain(' ');
    }
  });
});
