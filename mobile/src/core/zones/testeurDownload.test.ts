// Tester tests for C2 to C5, written from the spec and ADR 0013.
import { parseCatalogue } from './catalogue';
import {
  downloadZone,
  MAX_ATTEMPTS,
  requestZone,
  RETRY_DELAY_MS,
  WATCHDOG_MS,
  type DownloadState,
} from './downloadZone';
import {
  corrupt,
  createFakePhone,
  fail,
  hang,
  makeZone,
  ok,
  type FakePhone,
} from './fakeZoneOps';
import { deleteZone, scanZones } from './installedZones';
import { networkRule } from './networkRule';
import { planPath, readyPath, filePath } from './zoneLayout';
import { defaultSettings, parseSettings } from '../settings/settings';

const contents = { 'a.bin': 'AAAA', 'sub/b.bin': 'BBBBBB', 'c.json': 'CC' };
const zone = makeZone(contents);
const [urlA, urlB, urlC] = zone.files.map((f) => f.url);

function setup(z = zone) {
  const phone = createFakePhone();
  const states: DownloadState[] = [];
  const controller = new AbortController();
  const run = () =>
    downloadZone(z, phone.ops, controller.signal, (s) => {
      states.push(s);
      // Invariant: a ready marker never exists with an unchecked file.
      if (phone.files.has(readyPath(z)) && s.kind !== 'ready') {
        throw new Error('ready marker before the end');
      }
    });
  return { phone, states, controller, run };
}
const count = (p: FakePhone, url: string) =>
  p.started.filter((u) => u === url).length;
const hasReady = (p: FakePhone) => p.files.has(readyPath(zone));
function allFilesGood(p: FakePhone) {
  return zone.files.every(
    (f) =>
      p.files.get(filePath(zone, f)) ===
      contents[f.path as keyof typeof contents],
  );
}

describe('C2 damaged file refused', () => {
  it('same size, different content: refused, zone not ready, file erased', async () => {
    const { phone, run } = setup();
    phone.serve(urlA, ok('AAAA'));
    phone.serve(urlB, corrupt('BBBBBB'));
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(RETRY_DELAY_MS * MAX_ATTEMPTS * 2);
    const result = await p;
    expect(result.kind).toBe('failed');
    expect(hasReady(phone)).toBe(false);
    expect(phone.files.has(filePath(zone, zone.files[1]))).toBe(false);
    expect(count(phone, urlB)).toBe(MAX_ATTEMPTS);
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed).toEqual([]);
  });

  it('wrong size: refused, zone not ready', async () => {
    const { phone, run } = setup();
    phone.serve(urlA, ok('AAAA'));
    phone.serve(urlB, ok('BBB')); // 3 bytes instead of 6
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(RETRY_DELAY_MS * MAX_ATTEMPTS * 2);
    expect((await p).kind).toBe('failed');
    expect(hasReady(phone)).toBe(false);
  });

  it('error page written instead of the file (too long): refused', async () => {
    const { phone, run } = setup();
    phone.serve(urlA, ok('<html>404 not found</html>'));
    phone.serve(urlB, ok('BBBBBB'));
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(RETRY_DELAY_MS * MAX_ATTEMPTS * 2);
    expect((await p).kind).toBe('failed');
    expect(hasReady(phone)).toBe(false);
  });

  it('a damaged file followed by a good one is accepted on retry', async () => {
    const { phone, run } = setup();
    phone.serve(urlA, corrupt('AAAA'), ok('AAAA'));
    phone.serve(urlB, ok('BBBBBB'));
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(RETRY_DELAY_MS * 2);
    expect(await p).toEqual({ kind: 'ready' });
    expect(allFilesGood(phone)).toBe(true);
  });

  it('a damaged file left on disk is not kept at resume', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    await requestZone(zone, phone.ops);
    phone.files.set(filePath(zone, zone.files[0]), 'XXXX'); // same size
    expect(await run()).toEqual({ kind: 'ready' });
    expect(count(phone, urlA)).toBe(1);
    expect(phone.files.get(filePath(zone, zone.files[0]))).toBe('AAAA');
  });
});

describe('C3 cut, resume, closed app', () => {
  it('cut in the middle of a file: no ready marker, then resume keeps good files', async () => {
    const { phone, run } = setup();
    phone.serve(urlA, ok('AAAA'));
    phone.serve(urlB, fail);
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(RETRY_DELAY_MS * MAX_ATTEMPTS * 2);
    expect((await p).kind).toBe('failed');
    expect(hasReady(phone)).toBe(false);
    expect(phone.files.get(filePath(zone, zone.files[0]))).toBe('AAAA');

    // "App closed and reopened": a new call on the same fake disk.
    const scan = await scanZones(phone.ops, true);
    expect(scan.installed).toEqual([]);
    expect(scan.interrupted.map((z) => z.id)).toEqual(['nancy']);
    phone.started.length = 0;
    phone.serveZone(zone, contents);
    const again = await downloadZone(
      zone,
      phone.ops,
      new AbortController().signal,
      () => {},
    );
    expect(again).toEqual({ kind: 'ready' });
    expect(phone.started).not.toContain(urlA);
    expect(phone.started).toContain(urlB);
    expect(allFilesGood(phone)).toBe(true);
    expect(phone.files.has(planPath(zone))).toBe(false);
  });

  it('abort in the middle of a file: cancelled, never half ready', async () => {
    const { phone, controller, run } = setup();
    phone.serve(urlA, ok('AAAA'));
    phone.serve(urlB, hang('BB'));
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(1000);
    controller.abort();
    expect(await p).toEqual({ kind: 'cancelled' });
    expect(hasReady(phone)).toBe(false);
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed).toEqual([]);
    expect(scan.interrupted).toHaveLength(1);
  });

  it('app killed at the last moment: only the marker is missing, resume writes it without downloading', async () => {
    const { phone } = setup();
    phone.serveZone(zone, contents);
    await requestZone(zone, phone.ops);
    for (const f of zone.files) {
      phone.files.set(
        filePath(zone, f),
        contents[f.path as keyof typeof contents],
      );
    }
    expect(hasReady(phone)).toBe(false);
    const r = await downloadZone(
      zone,
      phone.ops,
      new AbortController().signal,
      () => {},
    );
    expect(r).toEqual({ kind: 'ready' });
    expect(phone.started).toEqual([]);
    expect(hasReady(phone)).toBe(true);
  });

  it('a folder with files but no marker is never listed as installed', async () => {
    const phone = createFakePhone();
    phone.files.set(filePath(zone, zone.files[0]), 'AAAA');
    expect((await scanZones(phone.ops, false)).installed).toEqual([]);
  });

  it('silent connection: the 30 s watchdog gives up on the file and retries', async () => {
    const { phone, run } = setup();
    phone.serve(urlA, hang(), ok('AAAA'));
    phone.serve(urlB, ok('BBBBBB'));
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(WATCHDOG_MS + RETRY_DELAY_MS + 1000);
    expect(await p).toEqual({ kind: 'ready' });
    expect(count(phone, urlA)).toBe(2);
  });

  it('ready marker is written only when every file is good (over a random mix of failures)', async () => {
    const { phone, run } = setup();
    phone.serve(urlA, fail, corrupt('AAAA'), ok('AAAA'));
    phone.serve(urlB, corrupt('BBBBBB'), fail, ok('BBBBBB'));
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(RETRY_DELAY_MS * 10);
    expect(await p).toEqual({ kind: 'ready' });
    expect(allFilesGood(phone)).toBe(true);
  });
});

describe('C4 Wi-Fi only', () => {
  it('is on by default (no file, unreadable file, empty object)', () => {
    expect(defaultSettings.wifiOnly).toBe(true);
    expect(parseSettings(null).wifiOnly).toBe(true);
    expect(parseSettings('not json').wifiOnly).toBe(true);
    expect(parseSettings('{}').wifiOnly).toBe(true);
    expect(parseSettings('{"wifiOnly":false}').wifiOnly).toBe(false);
  });

  it.each([
    [true, true, 'WIFI', 'allowed'],
    [true, true, 'ETHERNET', 'allowed'],
    [true, true, 'CELLULAR', 'no-wifi'],
    [true, true, 'VPN', 'no-wifi'],
    [true, true, 'UNKNOWN', 'no-wifi'],
    [false, true, 'CELLULAR', 'allowed'],
    [false, true, 'WIFI', 'allowed'],
    [true, false, 'WIFI', 'no-network'],
    [false, false, 'CELLULAR', 'no-network'],
    [true, true, 'NONE', 'no-network'],
    [false, true, 'NONE', 'no-network'],
  ])('rule wifiOnly=%s connected=%s type=%s -> %s', (w, c, type, out) => {
    expect(networkRule(w, { isConnected: c, type })).toBe(out);
  });

  it('on mobile data with the rule on: waits, downloads nothing; setting cut: goes', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    phone.network = { isConnected: true, type: 'CELLULAR' };
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(2000);
    expect(phone.started).toEqual([]);
    expect(states[states.length - 1]).toMatchObject({
      kind: 'waiting',
      reason: 'no-wifi',
    });
    expect(hasReady(phone)).toBe(false);

    phone.wifiOnly = false;
    phone.changeConditions();
    await phone.advance(1000);
    expect(await p).toEqual({ kind: 'ready' });
  });

  it('on mobile data with the rule already off: downloads at once', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.network = { isConnected: true, type: 'CELLULAR' };
    phone.wifiOnly = false;
    await requestZone(zone, phone.ops);
    expect(await run()).toEqual({ kind: 'ready' });
  });

  it('no network at all: waits, even with the rule off; Wi-Fi back: goes', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    phone.wifiOnly = false;
    phone.network = { isConnected: false, type: 'NONE' };
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(2000);
    expect(phone.started).toEqual([]);
    expect(states[states.length - 1]).toMatchObject({
      kind: 'waiting',
      reason: 'no-network',
    });
    phone.network = { isConnected: true, type: 'WIFI' };
    phone.changeConditions();
    await phone.advance(1000);
    expect(await p).toEqual({ kind: 'ready' });
  });

  it('Wi-Fi lost during a file: the file is cancelled, zone waits, resumes on Wi-Fi', async () => {
    const { phone, states, run } = setup();
    phone.serve(urlA, ok('AAAA'));
    phone.serve(urlB, hang('BB'), ok('BBBBBB'));
    phone.serve(urlC, ok('CC'));
    await requestZone(zone, phone.ops);
    const p = run();
    await phone.advance(1000);
    phone.network = { isConnected: true, type: 'CELLULAR' };
    phone.changeConditions();
    await phone.advance(1000);
    expect(states[states.length - 1]).toMatchObject({
      kind: 'waiting',
      reason: 'no-wifi',
    });
    expect(hasReady(phone)).toBe(false);
    phone.network = { isConnected: true, type: 'WIFI' };
    phone.changeConditions();
    await phone.advance(1000);
    expect(await p).toEqual({ kind: 'ready' });
    expect(allFilesGood(phone)).toBe(true);
  });
});

describe('C5 delete', () => {
  it('erases the zone folder, gives the place back, keeps other zones', async () => {
    const phone = createFakePhone();
    const otherContents = { 'map.bin': 'MMMMMMMM' };
    const other = makeZone(otherContents, 'metz', 1);
    phone.serveZone(zone, contents);
    phone.serveZone(other, otherContents);
    await requestZone(zone, phone.ops);
    await requestZone(other, phone.ops);
    const none = new AbortController().signal;
    await downloadZone(zone, phone.ops, none, () => {});
    await downloadZone(other, phone.ops, none, () => {});
    // An old version of nancy too: delete removes all versions.
    phone.files.set('zones/nancy/v2/old.bin', 'OLD');

    const used = () =>
      [...phone.files.entries()]
        .filter(([k]) => k.startsWith('zones/'))
        .reduce((s, [, v]) => s + v.length, 0);
    const before = used();
    const nancyBytes = [...phone.files.entries()]
      .filter(([k]) => k.startsWith('zones/nancy/'))
      .reduce((sum, [, v]) => sum + v.length, 0);
    expect(nancyBytes).toBeGreaterThan(0);
    expect((await scanZones(phone.ops, false)).installed).toHaveLength(2);

    await deleteZone('nancy', phone.ops);

    expect(
      [...phone.files.keys()].filter((k) => k.startsWith('zones/nancy')),
    ).toEqual([]);
    expect(await phone.ops.listDir('zones/nancy')).toEqual([]);
    expect(used()).toBe(before - nancyBytes);
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed.map((m) => m.zone.id)).toEqual(['metz']);
    expect(phone.files.get('zones/metz/v1/map.bin')).toBe('MMMMMMMM');
  });

  it('deleting an unknown zone is not an error', async () => {
    const phone = createFakePhone();
    await expect(deleteZone('nowhere', phone.ops)).resolves.toBeUndefined();
  });
});

describe('catalogue to download chain', () => {
  it('a parsed zone of the catalogue shape can be requested', async () => {
    const c = parseCatalogue({ formatVersion: 1, zones: [zone] });
    const phone = createFakePhone();
    await requestZone(c.zones[0], phone.ops);
    expect(phone.files.has(planPath(zone))).toBe(true);
  });
});
