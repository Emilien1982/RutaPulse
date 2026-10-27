import iosSuccess from './fixtures/ios-success.json';
import { formatDistance, formatDuration } from './formatRoute';

describe('formatDistance', () => {
  it('uses the French decimal comma, one decimal', () => {
    expect(formatDistance(25.1)).toBe('25,1 km');
    expect(formatDistance(12.04)).toBe('12,0 km');
  });

  it('shows meters under one kilometer', () => {
    expect(formatDistance(0.85)).toBe('850 m');
  });

  // Reference outside our code: Valhalla's own summary for forêt de Haye to
  // Nancy (fixtures, 5.918 km), as the Mac reference run reports it.
  it('formats the length given by Valhalla', () => {
    expect(formatDistance(iosSuccess.trip.summary.length)).toBe('5,9 km');
  });
});

describe('formatDuration', () => {
  it('shows minutes under one hour', () => {
    expect(formatDuration(1253.829)).toBe('21 min');
    expect(formatDuration(10)).toBe('1 min');
  });

  // Mockup 10: "1 h 35" for 95 minutes.
  it('shows hours and two-digit minutes', () => {
    expect(formatDuration(95 * 60)).toBe('1 h 35');
    expect(formatDuration(3600 + 5 * 60)).toBe('1 h 05');
    expect(formatDuration(3600)).toBe('1 h 00');
  });
});
