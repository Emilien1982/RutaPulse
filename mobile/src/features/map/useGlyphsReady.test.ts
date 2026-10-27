import { ensureGlyphs, glyphsDirUri } from './useGlyphsReady';

// In-memory imitation of expo-file-system. As in the real module, `copy` and
// `write` are asynchronous (they finish after a pause), and a copy onto an
// existing file fails without `overwrite`.
const mockFiles = new Map<string, string>();
const mockEvents: string[] = [];
let mockFailCopyOf: string | null = null;

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .join('/')
      .replace(/\/+/g, '/')
      .replace('file:/', 'file:///');
  const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get parentDirectory() {
      return new Directory(this.uri.slice(0, this.uri.lastIndexOf('/')));
    }
    create() {
      mockFiles.set(this.uri, mockFiles.get(this.uri) ?? '');
    }
    async write(text: string) {
      await pause();
      mockFiles.set(this.uri, text);
      mockEvents.push(`write:${this.uri.split('/glyphs/')[1]}`);
    }
    async copy(target: File, options?: { overwrite?: boolean }) {
      await pause();
      if (mockFailCopyOf && this.uri === mockFailCopyOf) {
        throw new Error('copy failed');
      }
      if (target.exists && !options?.overwrite) {
        throw new Error('Destination already exists');
      }
      mockFiles.set(target.uri, mockFiles.get(this.uri) ?? '');
      mockEvents.push(`copy:${target.uri.split('/glyphs/')[1]}`);
    }
  }

  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {}
    list() {
      const names = new Set<string>();
      for (const key of mockFiles.keys()) {
        if (key.startsWith(`${this.uri}/`)) {
          names.add(key.slice(this.uri.length + 1).split('/')[0]);
        }
      }
      return [...names].map((name) => ({
        name,
        delete: () => {
          for (const key of [...mockFiles.keys()]) {
            if (
              key.startsWith(`${this.uri}/${name}/`) ||
              key === `${this.uri}/${name}`
            )
              mockFiles.delete(key);
          }
        },
      }));
    }
  }

  return { File, Directory, Paths: { document: { uri: 'file:///doc/' } } };
});

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: (module: number) => ({
      localUri: `file:///cache/${module}.pbf`,
      downloadAsync: () => Promise.resolve(),
    }),
  },
}));

const assets = [
  { path: 'NotoSans-Regular/0-255.pbf', module: 1 },
  { path: 'NotoSans-Bold/0-255.pbf', module: 2 },
  { path: 'NotoSans-Italic/0-255.pbf', module: 3 },
];
const dir = 'file:///doc/glyphs/1';

beforeEach(() => {
  mockFiles.clear();
  mockEvents.length = 0;
  mockFailCopyOf = null;
  for (const a of assets) {
    mockFiles.set(`file:///cache/${a.module}.pbf`, `glyphs-${a.module}`);
  }
});

describe('glyphsDirUri', () => {
  it('has no trailing slash', () => {
    expect(glyphsDirUri()).toBe(dir);
  });
});

describe('ensureGlyphs', () => {
  it('copies every file, then writes .ready last', async () => {
    await ensureGlyphs(assets);
    for (const a of assets) {
      expect(mockFiles.get(`${dir}/${a.path}`)).toBe(`glyphs-${a.module}`);
    }
    expect(mockFiles.has(`${dir}/.ready`)).toBe(true);
    expect(mockEvents).toHaveLength(assets.length + 1);
    expect(mockEvents[mockEvents.length - 1]).toBe('write:1/.ready');
  });

  it('writes no .ready when a copy fails, and resumes later', async () => {
    mockFailCopyOf = 'file:///cache/2.pbf';
    await expect(ensureGlyphs(assets)).rejects.toThrow('copy failed');
    expect(mockFiles.has(`${dir}/.ready`)).toBe(false);

    // Next launch: a file was left half copied, and the copy goes on over it.
    mockFailCopyOf = null;
    mockFiles.set(`${dir}/NotoSans-Regular/0-255.pbf`, 'half');
    await ensureGlyphs(assets);
    expect(mockFiles.get(`${dir}/NotoSans-Regular/0-255.pbf`)).toBe('glyphs-1');
    expect(mockFiles.get(`${dir}/NotoSans-Italic/0-255.pbf`)).toBe('glyphs-3');
    expect(mockFiles.has(`${dir}/.ready`)).toBe(true);
  });

  it('copies nothing when .ready is there', async () => {
    mockFiles.set(`${dir}/.ready`, '1');
    await ensureGlyphs(assets);
    expect(mockEvents).toEqual([]);
  });

  it('erases the folders of the old versions', async () => {
    mockFiles.set('file:///doc/glyphs/0/NotoSans-Regular/0-255.pbf', 'old');
    mockFiles.set('file:///doc/glyphs/0/.ready', '0');
    await ensureGlyphs(assets);
    expect([...mockFiles.keys()].some((k) => k.includes('/glyphs/0/'))).toBe(
      false,
    );
    expect(mockFiles.has(`${dir}/.ready`)).toBe(true);
  });
});
