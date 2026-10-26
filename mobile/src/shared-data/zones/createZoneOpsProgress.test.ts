import { createZoneOps } from './createZoneOps';

jest.mock('expo-file-system', () =>
  jest.requireActual('./memoryFileSystem').createMemoryFileSystem(),
);
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

const mem = jest.requireMock('expo-file-system') as {
  dirs: Set<string>;
  File: { createDownloadTask: jest.Mock };
};

// iOS sends `bytesWritten` as a BigInt at run time, although the type says
// number: adding it to a number throws. The callback must get a number.
describe('createZoneOps, progress', () => {
  it('gives a number to the callback when the platform sends a BigInt', () => {
    mem.dirs.add('file:///doc');
    let sendProgress: (data: { bytesWritten: unknown }) => void = () => {};
    mem.File.createDownloadTask.mockImplementation(
      (
        _url: string,
        _file: unknown,
        options: { onProgress: typeof sendProgress },
      ) => {
        sendProgress = options.onProgress;
        return {
          downloadAsync: () => new Promise(() => {}),
          cancel: jest.fn(),
        };
      },
    );
    const onProgress = jest.fn();

    createZoneOps().startDownload('https://x/a.bin', 'zones/a.bin', onProgress);
    sendProgress({ bytesWritten: BigInt(10) });

    expect(onProgress).toHaveBeenCalledWith(10);
    expect(typeof onProgress.mock.calls[0][0]).toBe('number');
    expect(() => 5 + onProgress.mock.calls[0][0]).not.toThrow();
  });
});
