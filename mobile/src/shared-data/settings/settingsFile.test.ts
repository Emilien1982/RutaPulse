import { onSettingsChange, readSettings, writeSettings } from './settingsFile';

jest.mock('expo-file-system', () =>
  jest.requireActual('../zones/memoryFileSystem').createMemoryFileSystem(),
);

const mem = jest.requireMock('expo-file-system') as {
  files: Map<string, string>;
};

beforeEach(() => mem.files.clear());

describe('settings file', () => {
  it('gives Wi-Fi only when there is no file', async () => {
    expect(await readSettings()).toEqual({ wifiOnly: true });
  });

  it('writes then reads the setting', async () => {
    await writeSettings({ wifiOnly: false });
    expect(mem.files.get('file:///doc/settings.json')).toBe(
      '{"wifiOnly":false}',
    );
    expect(await readSettings()).toEqual({ wifiOnly: false });
  });

  it('gives the defaults for a damaged file', async () => {
    mem.files.set('file:///doc/settings.json', '{oops');
    expect(await readSettings()).toEqual({ wifiOnly: true });
  });

  it('tells the listeners after a write, until they stop', async () => {
    const listener = jest.fn();
    const stop = onSettingsChange(listener);
    await writeSettings({ wifiOnly: false });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    await writeSettings({ wifiOnly: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
