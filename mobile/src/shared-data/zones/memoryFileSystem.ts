// In-memory imitation of the part of expo-file-system that shared-data uses.
// Tests use it inside `jest.mock('expo-file-system', ...)`.

export function createMemoryFileSystem() {
  const files = new Map<string, string>();
  const dirs = new Set<string>(['file:///doc']);
  const join = (parts: unknown[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .join('/')
      .replace(/\/+/g, '/')
      .replace('file:/', 'file:///');

  class FakeFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    get size() {
      return (files.get(this.uri) ?? '').length;
    }
    async text() {
      return files.get(this.uri) ?? '';
    }
    create() {
      files.set(this.uri, files.get(this.uri) ?? '');
    }
    write(text: string) {
      files.set(this.uri, text);
    }
    delete() {
      files.delete(this.uri);
    }
    async digest() {
      return `digest-of-${files.get(this.uri)}`;
    }
    static createDownloadTask = jest.fn();
  }

  class FakeDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return dirs.has(this.uri);
    }
    create() {
      dirs.add(this.uri);
    }
    delete() {
      for (const key of [...files.keys()]) {
        if (key.startsWith(`${this.uri}/`)) files.delete(key);
      }
      for (const key of [...dirs]) {
        if (key === this.uri || key.startsWith(`${this.uri}/`))
          dirs.delete(key);
      }
    }
    list() {
      const names = new Set<string>();
      for (const key of [...files.keys(), ...dirs]) {
        if (key.startsWith(`${this.uri}/`)) {
          names.add(key.slice(this.uri.length + 1).split('/')[0]);
        }
      }
      return [...names].map((name) => ({ name }));
    }
  }

  const Paths = {
    document: { uri: 'file:///doc' },
    availableDiskSpace: 123,
    info: (...parts: string[]) => {
      const uri = join(parts);
      return {
        exists: files.has(uri) || dirs.has(uri),
        isDirectory: files.has(uri) ? false : dirs.has(uri) ? true : null,
      };
    },
  };

  return { files, dirs, File: FakeFile, Directory: FakeDirectory, Paths };
}
