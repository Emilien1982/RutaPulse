import { defaultSettings, parseSettings } from './settings';

describe('parseSettings', () => {
  it('reads wifiOnly', () => {
    expect(parseSettings('{"wifiOnly":false}')).toEqual({
      wifiOnly: false,
      brightness: 'auto',
    });
    expect(parseSettings('{"wifiOnly":true}')).toEqual(defaultSettings);
  });

  it('gives the defaults (Wi-Fi only) for a missing file', () => {
    expect(parseSettings(null)).toEqual({
      wifiOnly: true,
      brightness: 'auto',
    });
    expect(defaultSettings.wifiOnly).toBe(true);
  });

  it('gives "Automatique" for a file of phase 2 (no brightness)', () => {
    expect(parseSettings('{"wifiOnly":false}').brightness).toBe('auto');
  });

  it('reads the brightness and the Wi-Fi setting, each on its own', () => {
    expect(parseSettings('{"wifiOnly":false,"brightness":"max"}')).toEqual({
      wifiOnly: false,
      brightness: 'max',
    });
    // A wrong brightness does not clear the Wi-Fi setting, and the reverse.
    expect(parseSettings('{"wifiOnly":false,"brightness":"bright"}')).toEqual({
      wifiOnly: false,
      brightness: 'auto',
    });
    expect(parseSettings('{"wifiOnly":"no","brightness":"max"}')).toEqual({
      wifiOnly: true,
      brightness: 'max',
    });
  });

  it.each(['', 'not json', '[]', 'null', '{}', '{"wifiOnly":"no"}'])(
    'gives the defaults for the unreadable text %p',
    (text) => {
      expect(parseSettings(text)).toEqual(defaultSettings);
    },
  );
});
