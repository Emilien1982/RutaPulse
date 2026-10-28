// Narrow no-break space (U+202F) before the unit: gap M1 of design/comparaisons/p03-t6.md.
import iosSuccess from './fixtures/ios-success.json';
import { formatDistance, formatDuration } from './formatRoute';

describe('formatDistance', () => {
  it('uses the French decimal comma, one decimal', () => {
    expect(formatDistance(25.1)).toBe('25,1\u202Fkm');
    expect(formatDistance(12.04)).toBe('12,0\u202Fkm');
  });

  it('shows meters under one kilometer', () => {
    expect(formatDistance(0.85)).toBe('850\u202Fm');
  });

  // Reference outside our code: Valhalla's own summary for forêt de Haye to
  // Nancy (fixtures, 5.918 km), as the Mac reference run reports it.
  it('formats the length given by Valhalla', () => {
    expect(formatDistance(iosSuccess.trip.summary.length)).toBe('5,9\u202Fkm');
  });
});

describe('formatDuration', () => {
  it('shows minutes under one hour', () => {
    expect(formatDuration(1253.829)).toBe('21\u202Fmin');
    expect(formatDuration(10)).toBe('1\u202Fmin');
  });

  // Mockup 10: "1 h 35" for 95 minutes.
  it('shows hours and two-digit minutes', () => {
    expect(formatDuration(95 * 60)).toBe('1\u202Fh\u202F35');
    expect(formatDuration(3600 + 5 * 60)).toBe('1\u202Fh\u202F05');
    expect(formatDuration(3600)).toBe('1\u202Fh\u202F00');
  });
});
