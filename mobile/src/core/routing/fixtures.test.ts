import androidNotOpen from './fixtures/android-not-open.json';
import android171 from './fixtures/android-171.json';
import android442 from './fixtures/android-442.json';
import androidSuccess from './fixtures/android-success.json';
import androidUnreadable from './fixtures/android-zone-unreadable.json';
import ios171 from './fixtures/ios-171.json';
import ios442 from './fixtures/ios-442.json';
import iosNotOpen from './fixtures/ios-not-open.json';
import iosSuccess from './fixtures/ios-success.json';
import iosUnreadable from './fixtures/ios-zone-unreadable.json';

// Shape of the raw native outputs kept in ./fixtures (ADR 0015, section 5).
// core/ may not import @modules/*, so the real module is loaded with
// jest.requireActual (ESLint does not see it). The native binding is faked.
jest.mock('expo', () => ({ requireNativeModule: () => ({}) }));
const moduleConstants = jest.requireActual('@modules/valhalla-route') as {
  ERR_ENGINE_NOT_OPEN: string;
  ERR_ZONE_UNREADABLE: string;
};

const platforms = [
  {
    name: 'ios',
    success: iosSuccess,
    r171: ios171,
    r442: ios442,
    notOpen: iosNotOpen,
    unreadable: iosUnreadable,
  },
  {
    name: 'android',
    success: androidSuccess,
    r171: android171,
    r442: android442,
    notOpen: androidNotOpen,
    unreadable: androidUnreadable,
  },
];

describe.each(platforms)('relevé $name', (p) => {
  test('success contains trip.summary.length and trip.legs[0].shape', () => {
    expect(typeof p.success.trip.summary.length).toBe('number');
    expect(typeof p.success.trip.legs[0].shape).toBe('string');
    expect(p.success.trip.legs[0].shape.length).toBeGreaterThan(0);
  });

  // External reference: T1 trial log, "[ESSAI-T1] ... length=5.918km",
  // on both platforms.
  test('success distance is 5.918 km', () => {
    expect(p.success.trip.summary.length).toBe(5.918);
  });

  test('refusal 171 has numeric code 171', () => {
    expect(typeof p.r171.code).toBe('number');
    expect(p.r171.code).toBe(171);
  });

  test('refusal 442 has numeric code 442', () => {
    expect(typeof p.r442.code).toBe('number');
    expect(p.r442.code).toBe(442);
  });

  test('not-open rejection code equals the module constant', () => {
    expect(p.notOpen.rejected.code).toBe(moduleConstants.ERR_ENGINE_NOT_OPEN);
    expect(moduleConstants.ERR_ENGINE_NOT_OPEN).toBe('ERR_ENGINE_NOT_OPEN');
  });

  test('zone-unreadable rejection code equals the module constant', () => {
    expect(p.unreadable.rejected.code).toBe(
      moduleConstants.ERR_ZONE_UNREADABLE,
    );
    expect(moduleConstants.ERR_ZONE_UNREADABLE).toBe('ERR_ZONE_UNREADABLE');
  });

  test('no local path in the recordings', () => {
    const text = JSON.stringify(p);
    expect(text).not.toContain('/Users/');
    expect(text).not.toContain('/data/user');
  });
});
