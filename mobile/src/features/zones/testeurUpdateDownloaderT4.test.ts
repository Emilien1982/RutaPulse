// Tests of the update flow through the downloader (phase 5b, T4), written
// from the spec (C9, C10) and ADR 0018, section 3. Only the edges are faked:
// the disk and the network (`createFakePhone`).
//
// The numbers of the "general" case come from the catalogue published at
// https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json
// (zone nancy v3 110962386 bytes; v4 111360850 bytes, read 2 Nov 2026), see
// `core/zones/testeurUpdateT4.test.ts`.
import { Store } from '@tanstack/react-store';

import {
  createFakePhone,
  corrupt,
  hang,
  makeZone,
  ok,
  type FakePhone,
} from '@/core/zones/fakeZoneOps';
import type { Zone } from '@/core/zones/catalogue';
import { scanZones } from '@/core/zones/installedZones';
import {
  filePath,
  planPath,
  readyPath,
  serializePlan,
  serializeReady,
} from '@/core/zones/zoneLayout';
import { buildZoneRows, type DownloadEntry } from '@/core/zones/zoneRow';

import { createZoneDownloader } from './zoneDownloader';

const contents3 = { 'a.bin': 'AAAA', 'b.bin': 'BBBBBB', 'z.json': 'ZZ' };
const contents4 = { 'a.bin': 'CCCCC', 'b.bin': 'DDDDDDD', 'z.json': 'EEE' };
const z3 = makeZone(contents3, 'nancy', 3);
const z4 = makeZone(contents4, 'nancy', 4);
const urlB4 = z4.files[1].url;

function install(phone: FakePhone, zone: Zone, contents: object) {
  phone.files.set(
    readyPath(zone),
    serializeReady(zone, '2026-10-24T10:12:31Z'),
  );
  for (const [path, text] of Object.entries(contents)) {
    phone.files.set(filePath(zone, { path }), text as string);
  }
}

function launch(phone: FakePhone) {
  const store = new Store<Record<string, DownloadEntry>>({});
  const changes = jest.fn(() => Promise.resolve());
  const downloader = createZoneDownloader(phone.ops, changes, store);
  return { store, changes, downloader };
}

function setup() {
  const phone = createFakePhone();
  install(phone, z3, contents3);
  phone.serveZone(z4, contents4);
  return { phone, ...launch(phone) };
}

const v3Files = (phone: FakePhone) =>
  JSON.stringify(
    [...phone.files.entries()]
      .filter(([k]) => k.startsWith('zones/nancy/v3/'))
      .sort(([a], [b]) => a.localeCompare(b)),
  );

describe('C9, an update never starts alone', () => {
  it('launch and resume with a newer version in the catalogue download nothing', async () => {
    const { phone, downloader, store } = setup();
    await downloader.resumeInterrupted();
    await phone.advance(60_000);
    expect(phone.started).toEqual([]);
    expect(store.get()).toEqual({});
    expect(phone.files.has(planPath(z4))).toBe(false);
  });

  it('request(v4), the touch of "Mettre à jour", downloads v4 and leaves v3 intact', async () => {
    const { phone, downloader, store, changes } = setup();
    const before = v3Files(phone);
    await downloader.request(z4);
    await phone.advance(1_000);

    expect(phone.started).toEqual(z4.files.map((f) => f.url));
    expect(phone.files.has(readyPath(z4))).toBe(true);
    expect(v3Files(phone)).toBe(before);
    // The entry leaves the store once the list of zones was read again.
    expect(store.get()).toEqual({});
    expect(changes).toHaveBeenCalledTimes(1);
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed.map((m) => m.zone.version).sort()).toEqual([3, 4]);
  });
});

describe('C9, the "Wi-Fi only" rule applies to an update', () => {
  it('on 4G with the rule on: waits, no byte fetched, the banner flag is up; the rule off starts it', async () => {
    const { phone, downloader, store } = setup();
    phone.network = { isConnected: true, type: 'CELLULAR' };
    phone.wifiOnly = true;
    await downloader.request(z4);
    await phone.advance(100);

    const entry = store.get().nancy;
    expect(entry.state).toMatchObject({ kind: 'waiting', reason: 'no-wifi' });
    expect(phone.started).toEqual([]);
    const rows = buildZoneRows(
      [z4],
      (await scanZones(phone.ops, false)).installed,
      store.get(),
    );
    expect(rows.waitingForWifi).toBe(true);
    expect(rows.installed[0].update).toMatchObject({
      kind: 'running',
      status: { kind: 'waiting', reason: 'no-wifi' },
    });

    phone.wifiOnly = false; // the switch of the banner
    phone.changeConditions();
    await phone.advance(1_000);
    expect(phone.files.has(readyPath(z4))).toBe(true);
    expect(store.get()).toEqual({});
  });

  it('back on the Wi-Fi: the waiting update starts by itself', async () => {
    const { phone, downloader } = setup();
    phone.network = { isConnected: true, type: 'CELLULAR' };
    await downloader.request(z4);
    await phone.advance(100);
    expect(phone.started).toEqual([]);
    phone.network = { isConnected: true, type: 'WIFI' };
    phone.changeConditions();
    await phone.advance(1_000);
    expect(phone.files.has(readyPath(z4))).toBe(true);
  });
});

describe('C10, cut, closed app, cancel, failure', () => {
  it('app killed during v4: at launch v4 resumes by itself and v3 serves meanwhile', async () => {
    const first = setup();
    first.phone.serve(urlB4, hang('DD'));
    await first.downloader.request(z4);
    await first.phone.advance(10);
    expect(first.phone.started).toEqual([z4.files[0].url, urlB4]);
    // Killed: a new app on the same disk.
    const phone = first.phone;
    phone.started.length = 0;
    phone.serve(urlB4, ok(contents4['b.bin']));
    const second = launch(phone);
    await second.downloader.resumeInterrupted();
    // v4 is queued again, v3 is the only ready version.
    expect(second.store.get().nancy.zone.version).toBe(4);
    await phone.advance(1_000);

    expect(phone.files.has(readyPath(z4))).toBe(true);
    // a.bin was checked and kept: not downloaded again.
    expect(phone.started).not.toContain(z4.files[0].url);
    expect(phone.started).toContain(urlB4);
    expect(phone.files.get(filePath(z3, { path: 'a.bin' }))).toBe('AAAA');
  });

  it('the cross cancels the update: v4 folder gone, v3 intact and ready, entry gone', async () => {
    const { phone, downloader, store } = setup();
    const before = v3Files(phone);
    phone.serve(urlB4, hang('DD'));
    await downloader.request(z4);
    await phone.advance(10);
    expect(store.get().nancy.state.kind).toBe('downloading');

    await downloader.cancel('nancy');
    expect(store.get()).toEqual({});
    expect([...phone.files.keys()].some((k) => k.includes('/v4'))).toBe(false);
    expect(v3Files(phone)).toBe(before);
    expect(phone.files.has(readyPath(z3))).toBe(true);
    const rows = buildZoneRows(
      [z4],
      (await scanZones(phone.ops, false)).installed,
      store.get(),
    );
    expect(rows.installed[0].update).toMatchObject({ kind: 'available' });
  });

  it('failed fingerprint: the update fails on the card, v3 stays ready; "Réessayer" then succeeds', async () => {
    const { phone, downloader, store } = setup();
    phone.serve(urlB4, corrupt('DDDDDDD'));
    await downloader.request(z4);
    await phone.advance(60_000);

    expect(store.get().nancy.state.kind).toBe('failed');
    expect(phone.files.has(readyPath(z4))).toBe(false);
    expect(phone.files.has(readyPath(z3))).toBe(true);
    const rows = buildZoneRows(
      [z4],
      (await scanZones(phone.ops, false)).installed,
      store.get(),
    );
    expect(rows.installed[0].status).toEqual({ kind: 'ready' });
    expect(rows.installed[0].update).toMatchObject({
      kind: 'running',
      status: { kind: 'failed' },
    });

    phone.serve(urlB4, ok(contents4['b.bin']));
    downloader.retry('nancy');
    await phone.advance(1_000);
    expect(phone.files.has(readyPath(z4))).toBe(true);
  });

  it('a plan of a smaller version is erased at launch and not resumed', async () => {
    const phone = createFakePhone();
    install(phone, z4, contents4);
    phone.files.set(planPath(z3), serializePlan(z3));
    phone.files.set(filePath(z3, { path: 'a.bin' }), 'AA');
    const { downloader, store } = launch(phone);
    await downloader.resumeInterrupted();
    await phone.advance(1_000);
    expect(store.get()).toEqual({});
    expect(phone.started).toEqual([]);
    expect([...phone.files.keys()].some((k) => k.includes('/v3'))).toBe(false);
    expect(phone.files.has(readyPath(z4))).toBe(true);
  });

  it('"Supprimer" on an updating zone erases every version', async () => {
    const { phone, downloader, store } = setup();
    phone.serve(urlB4, hang('DD'));
    await downloader.request(z4);
    await phone.advance(10);
    await downloader.remove('nancy');
    expect(store.get()).toEqual({});
    expect(
      [...phone.files.keys()].some((k) => k.startsWith('zones/nancy')),
    ).toBe(false);
  });
});
