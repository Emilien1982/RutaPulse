import { networkRule } from './networkRule';

// The table of ADR 0013, section 6.
describe('networkRule', () => {
  it.each([
    [true, 'WIFI', true, 'allowed'],
    [true, 'ETHERNET', true, 'allowed'],
    [true, 'CELLULAR', true, 'no-wifi'],
    [true, 'VPN', true, 'no-wifi'],
    [true, 'UNKNOWN', true, 'no-wifi'],
    [false, 'WIFI', true, 'allowed'],
    [false, 'CELLULAR', true, 'allowed'],
    [false, 'VPN', true, 'allowed'],
    [true, 'WIFI', false, 'no-network'],
    [false, 'CELLULAR', false, 'no-network'],
    [true, 'NONE', true, 'no-network'],
    [false, 'NONE', true, 'no-network'],
  ])(
    'wifiOnly=%s, type=%s, connected=%s gives %s',
    (wifiOnly, type, isConnected, expected) => {
      expect(networkRule(wifiOnly, { type, isConnected })).toBe(expected);
    },
  );
});
