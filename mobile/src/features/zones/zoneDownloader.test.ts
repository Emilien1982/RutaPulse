import { Store } from '@tanstack/react-store';

import type { Zone } from '@/core/zones/catalogue';
import {
  corrupt,
  createFakePhone,
  hang,
  makeZone,
  ok,
  type FakePhone,
} from '@/core/zones/fakeZoneOps';
import { requestZone } from '@/core/zones/downloadZone';
import { parseMarker, planPath, readyPath } from '@/core/zones/zoneLayout';
import type { DownloadEntry } from '@/core/zones/zoneRow';

import { createZoneDownloader } from './zoneDownloader';

const nancyFiles = { 'a.bin': 'AAAA', 'z.json': 'ZZ' };
const metzFiles = { 'm.bin': 'MMMMMM' };
const nancy = makeZone(nancyFiles, 'nancy');
const metz = makeZone(metzFiles, 'metz');

function setup() {
  const phone = createFakePhone();
  phone.serveZone(nancy, nancyFiles);
  phone.serveZone(metz, metzFiles);
  const store = new Store<Record<string, DownloadEntry>>({});
  const installedChanges: string[] = [];
  const downloader = createZoneDownloader(
    phone.ops,
    () => {
      // What the screen would read at this moment.
      installedChanges.push(
        [...phone.files.keys()].filter((k) => k.endsWith('.ready.json')).join(),
      );
    },
    store,
  );
  const kinds = () =>
    Object.fromEntries(
      Object.values(store.get()).map((e) => [e.zone.id, e.state.kind]),
    );
  return { phone, store, downloader, installedChanges, kinds };
}

const isReady = (phone: FakePhone, zone: Zone) =>
  phone.files.has(readyPath(zone));

describe('zoneDownloader, request', () => {
  it('writes the plan, downloads, then leaves the store once ready', async () => {
    const { phone, store, downloader, installedChanges } = setup();
    await downloader.request(nancy);
    expect(phone.files.has(planPath(nancy))).toBe(true);
    await phone.advance(0);

    expect(isReady(phone, nancy)).toBe(true);
    expect(store.get()).toEqual({});
    // The list of installed zones is read before the entry leaves the store.
    expect(installedChanges).toEqual(['zones/nancy/v3/.ready.json']);
  });

  it('ignores a second request for a zone already on its way', async () => {
    const { phone, downloader } = setup();
    await downloader.request(nancy);
    await downloader.request(nancy);
    await phone.advance(0);
    expect(phone.started.filter((u) => u === nancy.files[0].url)).toHaveLength(
      1,
    );
  });
});

describe('zoneDownloader, queue', () => {
  it('downloads one zone at a time, the next one waits its turn', async () => {
    const { phone, downloader, kinds } = setup();
    phone.serve(nancy.files[0].url, hang('AA'));
    await downloader.request(nancy);
    await downloader.request(metz);
    await phone.advance(1000);

    expect(kinds()).toEqual({ nancy: 'downloading', metz: 'queued' });
    expect(phone.started).toEqual([nancy.files[0].url]);

    await downloader.cancel('nancy');
    await phone.advance(0);
    expect(isReady(phone, metz)).toBe(true);
  });

  it('starts the next zone after a ready one', async () => {
    const { phone, downloader } = setup();
    await downloader.request(nancy);
    await downloader.request(metz);
    await phone.advance(0);
    expect(isReady(phone, nancy)).toBe(true);
    expect(isReady(phone, metz)).toBe(true);
  });

  it('does not let a failed zone block the queue, and retries on demand', async () => {
    const { phone, downloader, kinds } = setup();
    phone.serve(nancy.files[0].url, corrupt('AAAA'));
    await downloader.request(nancy);
    await downloader.request(metz);
    await phone.advance(60_000);

    expect(kinds()).toEqual({ nancy: 'failed' });
    expect(isReady(phone, metz)).toBe(true);
    expect(phone.files.has(planPath(nancy))).toBe(true);

    phone.serve(nancy.files[0].url, ok('AAAA'));
    downloader.retry('nancy');
    await phone.advance(0);
    expect(isReady(phone, nancy)).toBe(true);
  });

  it('shows "no-space" and restarts on retry', async () => {
    const { phone, downloader, kinds } = setup();
    phone.space = 1000;
    await downloader.request(nancy);
    await phone.advance(0);
    expect(kinds()).toEqual({ nancy: 'no-space' });

    phone.space = 10_000_000_000;
    downloader.retry('nancy');
    await phone.advance(0);
    expect(isReady(phone, nancy)).toBe(true);
  });
});

describe('zoneDownloader, network and setting', () => {
  it('waits without Wi-Fi, then goes on by itself when the Wi-Fi comes back', async () => {
    const { phone, downloader, kinds, store } = setup();
    phone.network = { isConnected: true, type: 'CELLULAR' };
    await downloader.request(nancy);
    await phone.advance(0);

    expect(kinds()).toEqual({ nancy: 'waiting' });
    expect(store.get().nancy.state).toMatchObject({
      kind: 'waiting',
      reason: 'no-wifi',
    });
    expect(phone.started).toEqual([]);

    phone.network = { isConnected: true, type: 'WIFI' };
    phone.changeConditions();
    await phone.advance(0);
    expect(isReady(phone, nancy)).toBe(true);
  });

  it('keeps the files already checked while it waits', async () => {
    const { phone, downloader, store } = setup();
    // The second file hangs; the Wi-Fi is lost during it.
    phone.serve(nancy.files[1].url, hang('Z'));
    await downloader.request(nancy);
    await phone.advance(100);
    expect(store.get().nancy.state.kind).toBe('downloading');

    phone.network = { isConnected: true, type: 'CELLULAR' };
    phone.changeConditions();
    await phone.advance(100);

    expect(store.get().nancy.state).toMatchObject({
      kind: 'waiting',
      reason: 'no-wifi',
      doneBytes: 4,
      totalBytes: 6,
    });
    expect(phone.files.get('zones/nancy/v3/a.bin')).toBe('AAAA');
  });

  it('says "no-network" when there is no network at all', async () => {
    const { phone, downloader, store } = setup();
    phone.network = { isConnected: false, type: 'NONE' };
    await downloader.request(nancy);
    await phone.advance(0);
    expect(store.get().nancy.state).toMatchObject({
      kind: 'waiting',
      reason: 'no-network',
    });
  });

  it('starts over mobile data as soon as "Wi-Fi only" is switched off', async () => {
    const { phone, downloader, kinds } = setup();
    phone.network = { isConnected: true, type: 'CELLULAR' };
    await downloader.request(nancy);
    await phone.advance(0);
    expect(kinds()).toEqual({ nancy: 'waiting' });

    phone.wifiOnly = false;
    phone.changeConditions();
    await phone.advance(0);
    expect(isReady(phone, nancy)).toBe(true);
  });
});

describe('zoneDownloader, cancel and remove', () => {
  it('cancels a running download and erases its folder', async () => {
    const { phone, store, downloader, installedChanges } = setup();
    phone.serve(nancy.files[0].url, hang('AA'));
    await downloader.request(nancy);
    await phone.advance(100);

    await downloader.cancel('nancy');
    await phone.advance(0);

    expect(store.get()).toEqual({});
    expect([...phone.files.keys()]).toEqual([]);
    expect(installedChanges).toHaveLength(1);
  });

  it('cancels a zone that is still in the queue', async () => {
    const { phone, store, downloader } = setup();
    phone.serve(nancy.files[0].url, hang('AA'));
    await downloader.request(nancy);
    await downloader.request(metz);
    await phone.advance(100);

    await downloader.cancel('metz');
    expect(Object.keys(store.get())).toEqual(['nancy']);
    expect(
      [...phone.files.keys()].some((k) => k.startsWith('zones/metz')),
    ).toBe(false);
  });

  it('deletes an installed zone, all versions', async () => {
    const { phone, downloader, installedChanges } = setup();
    await downloader.request(nancy);
    await phone.advance(0);
    phone.files.set('zones/nancy/v2/.ready.json', 'old');

    await downloader.remove('nancy');

    expect([...phone.files.keys()]).toEqual([]);
    expect(installedChanges).toHaveLength(2);
  });
});

describe('zoneDownloader, resume at launch', () => {
  it('resumes an interrupted download and keeps the files already checked', async () => {
    const { phone, downloader } = setup();
    // Left by a closed app: the plan, one good file, one partial file.
    await requestZone(nancy, phone.ops);
    phone.files.set('zones/nancy/v3/a.bin', 'AAAA');
    phone.files.set('zones/nancy/v3/z.json', 'Z');

    await downloader.resumeInterrupted();
    await phone.advance(0);

    expect(phone.started).toEqual([nancy.files[1].url]);
    expect(isReady(phone, nancy)).toBe(true);
    expect(
      parseMarker(phone.files.get(readyPath(nancy)) ?? null)?.installedAt,
    ).toBeDefined();
  });

  it('never shows a half ready zone: a folder without plan is erased', async () => {
    const { phone, store, downloader } = setup();
    phone.files.set('zones/nancy/v3/a.bin', 'AAAA');

    await downloader.resumeInterrupted();
    await phone.advance(0);

    expect(store.get()).toEqual({});
    expect(isReady(phone, nancy)).toBe(false);
    expect([...phone.files.keys()]).toEqual([]);
  });

  it('resumes under the network rule', async () => {
    const { phone, store, downloader } = setup();
    phone.network = { isConnected: true, type: 'CELLULAR' };
    await requestZone(metz, phone.ops);

    await downloader.resumeInterrupted();
    await phone.advance(0);
    expect(store.get().metz.state).toMatchObject({ kind: 'waiting' });
    expect(isReady(phone, metz)).toBe(false);
  });

  it('does not touch a zone that is already ready', async () => {
    const { phone, store, downloader } = setup();
    await downloader.request(nancy);
    await phone.advance(0);
    const started = phone.started.length;

    await downloader.resumeInterrupted();
    await phone.advance(0);
    expect(store.get()).toEqual({});
    expect(phone.started).toHaveLength(started);
    expect(isReady(phone, nancy)).toBe(true);
  });
});

describe('zoneDownloader, request that fails', () => {
  it('shows a failure, with a way to try again, when the plan cannot be written', async () => {
    const { phone, store, downloader } = setup();
    const writeText = phone.ops.writeText;
    phone.ops.writeText = () => Promise.reject(new Error('disk full'));

    await downloader.request(nancy);
    expect(store.get().nancy.state.kind).toBe('failed');
    expect(phone.started).toEqual([]);

    phone.ops.writeText = writeText;
    downloader.retry('nancy');
    await phone.advance(0);
    expect(isReady(phone, nancy)).toBe(true);
  });

  it('writes the plan on retry, so that a killed app can resume', async () => {
    const { phone, downloader } = setup();
    const writeText = phone.ops.writeText;
    phone.ops.writeText = () => Promise.reject(new Error('disk full'));
    await downloader.request(nancy);

    phone.ops.writeText = writeText;
    phone.serve(nancy.files[0].url, hang('AA'));
    downloader.retry('nancy');
    await phone.advance(100);

    // Still downloading: the plan must be on the disk by now.
    expect(phone.files.has(planPath(nancy))).toBe(true);
    expect(isReady(phone, nancy)).toBe(false);
  });
});
