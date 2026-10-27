import { defaultSettings, parseSettings } from './settings';

describe('parseSettings', () => {
  it('reads wifiOnly', () => {
    expect(parseSettings('{"wifiOnly":false}')).toEqual({ wifiOnly: false });
    expect(parseSettings('{"wifiOnly":true}')).toEqual({ wifiOnly: true });
  });

  it('gives the defaults (Wi-Fi only) for a missing file', () => {
    expect(parseSettings(null)).toEqual({ wifiOnly: true });
    expect(defaultSettings.wifiOnly).toBe(true);
  });

  it.each(['', 'not json', '[]', 'null', '{}', '{"wifiOnly":"no"}'])(
    'gives the defaults for the unreadable text %p',
    (text) => {
      expect(parseSettings(text)).toEqual(defaultSettings);
    },
  );
});
