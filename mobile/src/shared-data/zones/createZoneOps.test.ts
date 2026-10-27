import { createZoneOps } from './createZoneOps';
import { zoneFileUri } from './zoneFileUri';

jest.mock('expo-file-system', () =>
  jest.requireActual('./memoryFileSystem').createMemoryFileSystem(),
);
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

const mem = jest.requireMock('expo-file-system') as {
  files: Map<string, string>;
  dirs: Set<string>;
  File: { createDownloadTask: jest.Mock };
};
const network = jest.requireMock('expo-network') as {
  getNetworkStateAsync: jest.Mock;
  addNetworkStateListener: jest.Mock;
};

const ops = createZoneOps();

beforeEach(() => {
  mem.files.clear();
  mem.dirs.clear();
  mem.dirs.add('file:///doc');
  jest.clearAllMocks();
});

describe('createZoneOps files', () => {
  it('writes and reads text, creating the file', async () => {
    await ops.writeText('zones/nancy/v3/.plan.json', 'plan');
    expect(await ops.readText('zones/nancy/v3/.plan.json')).toBe('plan');
    expect(await ops.readText('zones/nancy/v3/.ready.json')).toBeNull();
  });

  it('gives the size, or null when there is no file', async () => {
    mem.files.set('file:///doc/zones/a.bin', 'abcd');
    expect(await ops.fileSize('zones/a.bin')).toBe(4);
    expect(await ops.fileSize('zones/missing.bin')).toBeNull();
  });

  it('lists a folder, and gives an empty list for a missing one', async () => {
    mem.files.set('file:///doc/zones/nancy/v3/a.bin', 'a');
    mem.files.set('file:///doc/zones/nancy/v2/a.bin', 'a');
    mem.dirs.add('file:///doc/zones/nancy');
    expect((await ops.listDir('zones/nancy')).sort()).toEqual(['v2', 'v3']);
    expect(await ops.listDir('zones/other')).toEqual([]);
  });

  it('removes a file, a folder with its content, and nothing without error', async () => {
    mem.files.set('file:///doc/zones/nancy/v3/a.bin', 'a');
    mem.files.set('file:///doc/zones/nancy/v3/b.bin', 'b');
    mem.dirs.add('file:///doc/zones/nancy');
    mem.dirs.add('file:///doc/zones/nancy/v3');
    await ops.remove('zones/nancy/v3/a.bin');
    expect([...mem.files.keys()]).toEqual(['file:///doc/zones/nancy/v3/b.bin']);
    await ops.remove('zones/nancy');
    expect(mem.files.size).toBe(0);
    await expect(ops.remove('zones/nancy')).resolves.toBeUndefined();
  });

  it('creates folders and gives the free room', async () => {
    await ops.makeDir('zones/nancy/v3/elevation');
    expect(mem.dirs.has('file:///doc/zones/nancy/v3/elevation')).toBe(true);
    expect(await ops.availableSpace()).toBe(123);
  });

  it('gives the fingerprint of the file', async () => {
    mem.files.set('file:///doc/a.bin', 'x');
    expect(await ops.sha256('a.bin')).toBe('digest-of-x');
  });

  it('gives an address for the map', () => {
    expect(zoneFileUri({ id: 'nancy', version: 3 }, 'map.pmtiles')).toBe(
      'file:///doc/zones/nancy/v3/map.pmtiles',
    );
  });
});

describe('createZoneOps download', () => {
  function task(result: unknown) {
    return {
      downloadAsync: jest.fn().mockResolvedValue(result),
      cancel: jest.fn(),
    };
  }

  it('downloads in the foreground and reports the bytes written', async () => {
    const t = task({});
    mem.File.createDownloadTask.mockReturnValue(t);
    const onProgress = jest.fn();
    const handle = ops.startDownload('https://x/y', 'zones/y', onProgress);
    await expect(handle.done).resolves.toBeUndefined();
    const [url, destination, options] =
      mem.File.createDownloadTask.mock.calls[0];
    expect(url).toBe('https://x/y');
    expect(destination.uri).toBe('file:///doc/zones/y');
    expect(options.sessionType).toBe('foreground');
    options.onProgress({ bytesWritten: 7, totalBytes: 9 });
    expect(onProgress).toHaveBeenCalledWith(7);
    handle.cancel();
    expect(t.cancel).toHaveBeenCalled();
  });

  it('fails when the download does not finish', async () => {
    mem.File.createDownloadTask.mockReturnValue(task(null));
    await expect(
      ops.startDownload('https://x/y', 'y', jest.fn()).done,
    ).rejects.toThrow();
  });
});

describe('createZoneOps network and time', () => {
  it('gives safe values when the network state is incomplete', async () => {
    network.getNetworkStateAsync.mockResolvedValue({});
    expect(await ops.getNetwork()).toEqual({
      isConnected: false,
      type: 'UNKNOWN',
    });
    network.getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      type: 'WIFI',
    });
    expect(await ops.getNetwork()).toEqual({ isConnected: true, type: 'WIFI' });
  });

  it('listens to the network and to the setting, and stops both', () => {
    const remove = jest.fn();
    network.addNetworkStateListener.mockReturnValue({ remove });
    const stop = ops.onConditionsChange(jest.fn());
    expect(network.addNetworkStateListener).toHaveBeenCalledTimes(1);
    stop();
    expect(remove).toHaveBeenCalled();
  });

  it('gives the time without milliseconds', () => {
    expect(ops.now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('runs and cancels a timer', () => {
    jest.useFakeTimers();
    const first = jest.fn();
    const second = jest.fn();
    ops.setTimer(100, first);
    ops.setTimer(100, second)();
    jest.advanceTimersByTime(100);
    expect(first).toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
