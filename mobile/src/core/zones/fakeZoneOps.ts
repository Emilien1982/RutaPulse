// Fake phone for the tests of core/zones: files in memory, a scripted
// server, a network that tests change by hand, and timers that tests advance.

import { createHash } from 'node:crypto';

import type { Zone } from './catalogue';
import type { NetworkInfo } from './networkRule';
import type { DownloadHandle, ZoneOps } from './zoneOps';

export function sha256Of(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** A zone whose files have the given contents (one letter = one byte). */
export function makeZone(
  contents: Record<string, string>,
  id = 'nancy',
  version = 3,
): Zone {
  const files = Object.entries(contents).map(([path, text]) => ({
    path,
    bytes: text.length,
    sha256: sha256Of(text),
    url: `https://github.com/x/releases/download/zone-${id}-v${version}/${path.split('/').pop()}`,
  }));
  return {
    id,
    name: 'Nancy',
    version,
    bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: files.reduce((sum, f) => sum + f.bytes, 0),
    files,
  };
}

/** What the fake server does for one download. */
export type Behavior = (api: {
  path: string;
  existedAtStart: boolean;
  write: (text: string) => void;
  progress: (bytes: number) => void;
}) => Promise<void> | void;

export type FakePhone = {
  files: Map<string, string>;
  network: NetworkInfo;
  wifiOnly: boolean;
  space: number;
  started: string[];
  cancelCalls: number;
  serve: (url: string, ...list: Behavior[]) => void;
  serveZone: (zone: Zone, contents: Record<string, string>) => void;
  changeConditions: () => void;
  advance: (ms: number) => Promise<void>;
  flush: () => Promise<void>;
  ops: ZoneOps;
};

export function createFakePhone(): FakePhone {
  const files = new Map<string, string>();
  const behaviors = new Map<string, Behavior[]>();
  const listeners = new Set<() => void>();
  const timers: { at: number; callback: () => void }[] = [];
  let clock = 0;

  const phone: FakePhone = {
    files,
    network: { isConnected: true, type: 'WIFI' },
    wifiOnly: true,
    space: 10_000_000_000,
    /** Urls requested, in order. */
    started: [],
    cancelCalls: 0,

    /** The next downloads of `url` follow these behaviors, the last one repeats. */
    serve(url: string, ...list: Behavior[]) {
      behaviors.set(url, list);
    },
    /** Serves every file of the zone with its right content. */
    serveZone(zone: Zone, contents: Record<string, string>) {
      for (const f of zone.files) phone.serve(f.url, ok(contents[f.path]));
    },
    changeConditions() {
      listeners.forEach((l) => l());
    },
    /** Moves the clock; timers run in order. Lets pending promises settle. */
    async advance(ms: number) {
      const end = clock + ms;
      for (;;) {
        await flush();
        const next = timers
          .filter((t) => t.at <= end)
          .sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        timers.splice(timers.indexOf(next), 1);
        clock = next.at;
        next.callback();
      }
      clock = end;
      await flush();
    },
    flush,

    ops: {
      startDownload(url, path, onProgress): DownloadHandle {
        phone.started.push(url);
        const list = behaviors.get(url) ?? [];
        const behavior = list.length > 1 ? list.shift() : list[0];
        let reject: (e: Error) => void = () => {};
        let cancelled = false;
        const done = new Promise<void>((resolve, rej) => {
          reject = rej;
          const run = async () => {
            if (!behavior) throw new Error('404');
            await behavior({
              path,
              existedAtStart: files.has(path),
              write: (text) => files.set(path, text),
              progress: (n) => {
                if (!cancelled) onProgress(n);
              },
            });
          };
          run().then(() => {
            if (cancelled) rej(new Error('cancelled'));
            else resolve();
          }, rej);
        });
        done.catch(() => {});
        return {
          done,
          cancel: () => {
            cancelled = true;
            phone.cancelCalls += 1;
            reject(new Error('cancelled'));
          },
        };
      },
      fileSize: async (path) => files.get(path)?.length ?? null,
      sha256: async (path) => sha256Of(files.get(path) ?? ''),
      readText: async (path) => files.get(path) ?? null,
      writeText: async (path, text) => void files.set(path, text),
      makeDir: async () => {},
      listDir: async (path) => {
        const names = new Set<string>();
        for (const key of files.keys()) {
          if (key.startsWith(`${path}/`)) {
            names.add(key.slice(path.length + 1).split('/')[0]);
          }
        }
        return [...names];
      },
      remove: async (path) => {
        for (const key of [...files.keys()]) {
          if (key === path || key.startsWith(`${path}/`)) files.delete(key);
        }
      },
      availableSpace: async () => phone.space,
      getNetwork: async () => ({ ...phone.network }),
      getWifiOnly: async () => phone.wifiOnly,
      onConditionsChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setTimer: (ms, callback) => {
        const timer = { at: clock + ms, callback };
        timers.push(timer);
        return () => {
          const i = timers.indexOf(timer);
          if (i >= 0) timers.splice(i, 1);
        };
      },
      now: () => '2026-10-24T10:12:31Z',
    },
  };
  return phone;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export const ok =
  (text: string): Behavior =>
  ({ write, progress }) => {
    progress(Math.floor(text.length / 2));
    write(text);
    progress(text.length);
  };

/** Right size, wrong content. */
export const corrupt =
  (text: string): Behavior =>
  ({ write }) => {
    write('X'.repeat(text.length));
  };

export const fail: Behavior = ({ write }) => {
  write('par'); // like Android: a partial file stays after a cut
  throw new Error('network lost');
};

/** Writes a part, then never ends by itself (only `cancel` ends it). */
export const hang =
  (partial = 'par'): Behavior =>
  ({ write, progress }) => {
    write(partial);
    progress(partial.length);
    return new Promise(() => {});
  };
