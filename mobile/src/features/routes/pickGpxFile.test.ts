// The choice and the reading of a GPX file (ADR 0019, section 7; spec C10).
// The picker and the file system are faked; the reading is the real one.
import { pickGpxFile } from './pickGpxFile';

type FakeFile = { size: number; text?: string; fails?: boolean };
const mockFiles: Record<string, FakeFile> = {};
const mockTextCalls: string[] = [];
const mockDeleted: string[] = [];
const mockPicker = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockPicker(...args),
}));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockFiles[this.uri]?.size ?? 0;
    }
    text() {
      mockTextCalls.push(this.uri);
      const file = mockFiles[this.uri];
      if (!file || file.fails) return Promise.reject(new Error('unreadable'));
      return Promise.resolve(file.text ?? '');
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  }
  return { File };
});

const URI = 'file:///cache/DocumentPicker/sortie.gpx';
const GPX = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Rando</name><trkseg>
<trkpt lat="48.69" lon="6.18"/><trkpt lat="48.7" lon="6.19"/></trkseg></trk></gpx>`;

function pick(file: FakeFile, assetSize?: number) {
  mockFiles[URI] = file;
  mockPicker.mockResolvedValue({
    canceled: false,
    assets: [{ uri: URI, name: 'sortie.gpx', size: assetSize }],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTextCalls.length = 0;
  mockDeleted.length = 0;
  for (const key of Object.keys(mockFiles)) delete mockFiles[key];
  global.fetch = jest.fn();
});

describe('pickGpxFile', () => {
  it('asks for any type of file, copied to the cache, only one', async () => {
    pick({ size: GPX.length, text: GPX }, GPX.length);
    await pickGpxFile();
    expect(mockPicker).toHaveBeenCalledWith({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it('does nothing when the picker is cancelled', async () => {
    mockPicker.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickGpxFile()).toEqual({ status: 'cancelled' });
    expect(mockTextCalls).toEqual([]);
  });

  it('reads a GPX and erases the copy in the cache', async () => {
    pick({ size: GPX.length, text: GPX }, GPX.length);
    const result = await pickGpxFile();
    expect(result.status).toBe('read');
    if (result.status !== 'read') return;
    expect(result.fileName).toBe('sortie.gpx');
    expect(result.gpx.name).toBe('Rando');
    expect(result.gpx.track).toHaveLength(2);
    expect(mockDeleted).toEqual([URI]);
  });

  it('says when the reading starts', async () => {
    pick({ size: GPX.length, text: GPX }, GPX.length);
    const onReading = jest.fn();
    await pickGpxFile(onReading);
    expect(onReading).toHaveBeenCalledTimes(1);
  });

  it('refuses a file of more than 20 000 000 bytes without reading it', async () => {
    pick({ size: 34_000_000, text: GPX }, 34_000_000);
    expect(await pickGpxFile()).toEqual({
      status: 'refused',
      reason: 'tooBig',
      sizeBytes: 34_000_000,
    });
    expect(mockTextCalls).toEqual([]);
    expect(mockDeleted).toEqual([URI]);
  });

  it('refuses 20 000 001 bytes and reads 20 000 000', async () => {
    pick({ size: 20_000_001, text: GPX }, 20_000_001);
    expect((await pickGpxFile()).status).toBe('refused');
    expect(mockTextCalls).toEqual([]);
    pick({ size: 20_000_000, text: GPX }, 20_000_000);
    expect((await pickGpxFile()).status).toBe('read');
  });

  it('reads the size of the file when the picker gives none', async () => {
    pick({ size: 34_000_000, text: GPX }, undefined);
    expect(await pickGpxFile()).toMatchObject({
      status: 'refused',
      reason: 'tooBig',
    });
    expect(mockTextCalls).toEqual([]);
  });

  it('refuses an empty file (0 byte), or only spaces', async () => {
    pick({ size: 0 }, 0);
    expect(await pickGpxFile()).toEqual({ status: 'refused', reason: 'empty' });
    expect(mockTextCalls).toEqual([]);
    pick({ size: 4, text: ' \n\t ' }, 4);
    expect(await pickGpxFile()).toEqual({ status: 'refused', reason: 'empty' });
  });

  it('refuses a file that cannot be read as text', async () => {
    pick({ size: 10, fails: true }, 10);
    expect(await pickGpxFile()).toEqual({
      status: 'refused',
      reason: 'unreadable',
    });
    expect(mockDeleted).toEqual([URI]);
  });

  it.each([
    ['not XML', 'Bonjour, ceci est une photo.'],
    ['not a GPX', '<?xml version="1.0"?><kml><Document/></kml>'],
    ['broken tags', '<gpx><trk><trkseg></gpx>'],
    [
      'an external entity',
      '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY x SYSTEM "http://example.com/x">]><gpx><trk><trkseg>' +
        '<trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>',
    ],
  ])('refuses as unreadable: %s, with no network call', async (_l, text) => {
    pick({ size: text.length, text }, text.length);
    expect(await pickGpxFile()).toEqual({
      status: 'refused',
      reason: 'unreadable',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses a GPX with only isolated points', async () => {
    const text =
      '<gpx version="1.1"><wpt lat="48.6" lon="6.1"><name>A</name></wpt></gpx>';
    pick({ size: text.length, text }, text.length);
    expect(await pickGpxFile()).toEqual({
      status: 'refused',
      reason: 'noTrack',
    });
  });
});
