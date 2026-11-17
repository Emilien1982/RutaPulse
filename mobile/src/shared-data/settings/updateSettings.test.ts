import { readSettings } from './settingsFile';
import { updateSettings } from './updateSettings';

jest.mock('expo-file-system', () =>
  jest.requireActual('../zones/memoryFileSystem').createMemoryFileSystem(),
);

const mem = jest.requireMock('expo-file-system') as {
  files: Map<string, string>;
};

beforeEach(() => mem.files.clear());

describe('updateSettings', () => {
  it('changes one setting and keeps the other', async () => {
    mem.files.set(
      'file:///doc/settings.json',
      '{"wifiOnly":false,"brightness":"max"}',
    );
    await updateSettings({ wifiOnly: true });
    expect(await readSettings()).toEqual({ wifiOnly: true, brightness: 'max' });
    await updateSettings({ brightness: 'auto' });
    expect(await readSettings()).toEqual({
      wifiOnly: true,
      brightness: 'auto',
    });
  });

  it('starts from the defaults, and from a file of phase 2', async () => {
    await updateSettings({ brightness: 'max' });
    expect(await readSettings()).toEqual({ wifiOnly: true, brightness: 'max' });
    mem.files.set('file:///doc/settings.json', '{"wifiOnly":false}');
    await updateSettings({ brightness: 'max' });
    expect(await readSettings()).toEqual({
      wifiOnly: false,
      brightness: 'max',
    });
  });

  it('loses nothing when two changes come at once', async () => {
    await Promise.all([
      updateSettings({ wifiOnly: false }),
      updateSettings({ brightness: 'max' }),
    ]);
    expect(await readSettings()).toEqual({
      wifiOnly: false,
      brightness: 'max',
    });
  });
});
