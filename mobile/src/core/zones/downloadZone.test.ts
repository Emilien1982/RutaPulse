import {
  corrupt,
  createFakePhone,
  fail,
  hang,
  makeZone,
  ok,
  sha256Of,
  type FakePhone,
} from './fakeZoneOps';
import {
  downloadZone,
  MAX_ATTEMPTS,
  requestZone,
  SPARE_BYTES,
  WATCHDOG_MS,
  type DownloadState,
} from './downloadZone';
import { scanZones } from './installedZones';
import { parseMarker, planPath, readyPath } from './zoneLayout';

const contents = {
  'a.bin': 'AAAA',
  'elevation/N48/b.hgt': 'BBBBBB',
  'z.json': 'ZZ',
};
const zone = makeZone(contents);
const [urlA, urlB, urlZ] = zone.files.map((f) => f.url);
const dir = 'zones/nancy/v3';

function setup() {
  const phone = createFakePhone();
  const states: DownloadState[] = [];
  const controller = new AbortController();
  const run = () =>
    downloadZone(zone, phone.ops, controller.signal, (s) => states.push(s));
  return { phone, states, controller, run };
}

const last = (states: DownloadState[]) => states[states.length - 1];
const count = (phone: FakePhone, url: string) =>
  phone.started.filter((u) => u === url).length;

describe('downloadZone, normal case', () => {
  it('downloads the files in order, then writes the marker last', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    phone.files.set('zones/nancy/v2/.ready.json', 'old version');
    await requestZone(zone, phone.ops);

    expect(await run()).toEqual({ kind: 'ready' });

    expect(phone.started).toEqual([urlA, urlB, urlZ]);
    expect(phone.files.get(`${dir}/elevation/N48/b.hgt`)).toBe('BBBBBB');
    const ready = parseMarker(phone.files.get(readyPath(zone)) ?? null);
    expect(ready?.installedAt).toBe('2026-10-24T10:12:31Z');
    expect(phone.files.has(planPath(zone))).toBe(false);
    expect([...phone.files.keys()].some((k) => k.includes('/v2/'))).toBe(false);
    expect(last(states)).toEqual({ kind: 'ready' });
  });

  it('reports a progress that never goes back and never passes the total', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    await run();
    const bytes = states.flatMap((s) =>
      s.kind === 'downloading' ? [s.doneBytes] : [],
    );
    expect(bytes[0]).toBe(0);
    expect(Math.max(...bytes)).toBeGreaterThan(8);
    expect(Math.max(...bytes)).toBeLessThanOrEqual(zone.totalBytes);
    expect(bytes).toEqual([...bytes].sort((x, y) => x - y));
  });

  it('writes the plan on request', async () => {
    const { phone } = setup();
    await requestZone(zone, phone.ops);
    expect(parseMarker(phone.files.get(planPath(zone)) ?? null)?.zone).toEqual(
      zone,
    );
  });
});

describe('a damaged file is refused (C2)', () => {
  it('erases a file with the right size and a wrong fingerprint, 3 times, then fails', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlB, corrupt('BBBBBB'));
    const result = run();
    await phone.advance(60_000);

    expect(await result).toMatchObject({
      kind: 'failed',
      failedPath: 'elevation/N48/b.hgt',
    });
    expect(count(phone, urlB)).toBe(MAX_ATTEMPTS);
    expect(phone.files.has(`${dir}/elevation/N48/b.hgt`)).toBe(false);
    expect(phone.files.has(readyPath(zone))).toBe(false);
    expect(last(states)).toMatchObject({ kind: 'failed', doneBytes: 4 });
    expect(phone.files.get(`${dir}/a.bin`)).toBe('AAAA');
  });

  it('refuses a file with the wrong size', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlZ, ({ write }) => write('Z')); // truncated
    const result = run();
    await phone.advance(60_000);
    expect(await result).toMatchObject({
      kind: 'failed',
      failedPath: 'z.json',
    });
    expect(phone.files.has(`${dir}/z.json`)).toBe(false);
    expect(phone.files.has(readyPath(zone))).toBe(false);
  });

  it('tries again after a damaged file and succeeds', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlB, corrupt('BBBBBB'), ok('BBBBBB'));
    const result = run();
    await phone.advance(5_000);
    expect(await result).toEqual({ kind: 'ready' });
    expect(count(phone, urlB)).toBe(2);
  });

  it('does not keep a damaged file found at resume', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.files.set(`${dir}/a.bin`, 'XXXX'); // right size, wrong content
    expect(await run()).toEqual({ kind: 'ready' });
    expect(count(phone, urlA)).toBe(1);
    expect(phone.files.get(`${dir}/a.bin`)).toBe('AAAA');
  });

  // The expected fingerprint comes from outside the code:
  //   $ printf 'hello\n' | shasum -a 256
  //   5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03  -
  describe('with a fingerprint computed by shasum', () => {
    const shasum =
      '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03';
    const hello = {
      ...makeZone({ 'hello.txt': 'hello\n' }),
    };
    hello.files[0].sha256 = shasum;

    it('the test helper agrees with shasum', () => {
      expect(sha256Of('hello\n')).toBe(shasum);
    });

    it('accepts the right content and refuses another of the same size', async () => {
      const good = setup();
      good.phone.serve(hello.files[0].url, ok('hello\n'));
      const goodRun = downloadZone(
        hello,
        good.phone.ops,
        good.controller.signal,
        () => {},
      );
      expect(await goodRun).toEqual({ kind: 'ready' });

      const bad = setup();
      bad.phone.serve(hello.files[0].url, ({ write }) => write('hellp\n'));
      const badRun = downloadZone(
        hello,
        bad.phone.ops,
        bad.controller.signal,
        () => {},
      );
      await bad.phone.advance(60_000);
      expect(await badRun).toMatchObject({ kind: 'failed' });
    });
  });
});

describe('cuts and resume (C3)', () => {
  it('retries a file after an error, 5 seconds later', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlB, fail, ok('BBBBBB'));
    const result = run();
    await phone.advance(4_999);
    expect(count(phone, urlB)).toBe(1);
    await phone.advance(1);
    expect(await result).toEqual({ kind: 'ready' });
    expect(count(phone, urlB)).toBe(2);
  });

  it('erases the partial file before every attempt', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    const seen: boolean[] = [];
    phone.serve(
      urlB,
      (api) => {
        seen.push(api.existedAtStart);
        return fail(api);
      },
      (api) => {
        seen.push(api.existedAtStart);
        return ok('BBBBBB')(api);
      },
    );
    phone.files.set(`${dir}/elevation/N48/b.hgt`, 'BBB'); // left by a past stop
    const result = run();
    await phone.advance(5_000);
    expect(await result).toEqual({ kind: 'ready' });
    expect(seen).toEqual([false, false]);
  });

  it('after 3 failures keeps the checked files, then resumes without downloading them again', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlB, fail);
    const first = run();
    await phone.advance(60_000);
    expect(await first).toMatchObject({
      kind: 'failed',
      failedPath: 'elevation/N48/b.hgt',
    });
    expect(phone.files.get(`${dir}/a.bin`)).toBe('AAAA');
    expect(phone.files.has(readyPath(zone))).toBe(false);

    phone.serve(urlB, ok('BBBBBB')); // the user taps "Retry"
    expect(await run()).toEqual({ kind: 'ready' });
    expect(count(phone, urlA)).toBe(1);
  });

  it('after a closed app, finds the plan without marker and resumes it', async () => {
    const { phone, controller, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlZ, hang());
    await requestZone(zone, phone.ops);
    const interruptedRun = run();
    await phone.advance(0);
    // The app is killed here: the last file is partial, nothing is ready.
    expect(phone.files.has(readyPath(zone))).toBe(false);
    controller.abort();
    expect(await interruptedRun).toEqual({ kind: 'cancelled' });

    // Next launch: a new world made of the same disk.
    const relaunch = createFakePhone();
    for (const [path, text] of phone.files) relaunch.files.set(path, text);
    relaunch.serveZone(zone, contents);
    const scan = await scanZones(relaunch.ops, true);
    expect(scan.installed).toEqual([]);
    expect(scan.interrupted).toEqual([zone]);

    const resumed = await downloadZone(
      scan.interrupted[0],
      relaunch.ops,
      new AbortController().signal,
      () => {},
    );
    expect(resumed).toEqual({ kind: 'ready' });
    expect(relaunch.started).toEqual([urlZ]); // a.bin and b.hgt were kept
    const after = await scanZones(relaunch.ops, true);
    expect(after.installed).toHaveLength(1);
    expect(after.interrupted).toEqual([]);
  });

  it('never leaves a ready marker while a file is missing', async () => {
    const { phone, controller, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlZ, hang());
    const result = run();
    await phone.advance(0);
    expect(phone.files.has(readyPath(zone))).toBe(false);
    controller.abort();
    await result;
    expect(phone.files.has(readyPath(zone))).toBe(false);
  });
});

describe('Wi-Fi only (C4)', () => {
  it('waits without downloading on cellular, and starts when the Wi-Fi comes back', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    phone.network = { isConnected: true, type: 'CELLULAR' };
    const result = run();
    await phone.advance(10_000);
    expect(phone.started).toEqual([]);
    expect(last(states)).toEqual({
      kind: 'waiting',
      reason: 'no-wifi',
      doneBytes: 0,
      totalBytes: 12,
    });

    phone.network = { isConnected: true, type: 'WIFI' };
    phone.changeConditions();
    expect(await result).toEqual({ kind: 'ready' });
  });

  it('says "no network" when there is no connection', async () => {
    const { phone, states, controller, run } = setup();
    phone.network = { isConnected: false, type: 'NONE' };
    const result = run();
    await phone.advance(0);
    expect(last(states)).toMatchObject({
      kind: 'waiting',
      reason: 'no-network',
    });
    controller.abort();
    expect(await result).toEqual({ kind: 'cancelled' });
  });

  it('starts on cellular as soon as the setting is turned off', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.network = { isConnected: true, type: 'CELLULAR' };
    const result = run();
    await phone.advance(0);
    expect(phone.started).toEqual([]);

    phone.wifiOnly = false;
    phone.changeConditions();
    expect(await result).toEqual({ kind: 'ready' });
  });

  it('cancels the file in progress when the Wi-Fi disappears, keeps the checked files, and resumes without counting a failure', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlB, hang(), hang(), hang(), ok('BBBBBB'));
    const result = run();
    await phone.advance(0);
    expect(count(phone, urlB)).toBe(1);

    // Three cuts in a row: more than the 3 allowed failures.
    for (let cut = 1; cut <= 3; cut++) {
      phone.network = { isConnected: true, type: 'CELLULAR' };
      phone.changeConditions();
      await phone.advance(0);
      expect(phone.cancelCalls).toBe(cut);
      expect(last(states)).toEqual({
        kind: 'waiting',
        reason: 'no-wifi',
        doneBytes: 4, // only a.bin, checked
        totalBytes: 12,
      });
      phone.network = { isConnected: true, type: 'WIFI' };
      phone.changeConditions();
      await phone.advance(0);
      expect(count(phone, urlB)).toBe(cut + 1);
    }
    expect(await result).toEqual({ kind: 'ready' });
    expect(count(phone, urlA)).toBe(1);
  });
});

describe('watchdog', () => {
  it('cancels a file that receives nothing for 30 seconds, then retries', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlB, hang(), ok('BBBBBB'));
    const result = run();
    await phone.advance(WATCHDOG_MS - 1);
    expect(phone.cancelCalls).toBe(0);
    await phone.advance(1);
    expect(phone.cancelCalls).toBe(1);
    await phone.advance(5_000);
    expect(await result).toEqual({ kind: 'ready' });
    expect(count(phone, urlB)).toBe(2);
  });

  it('is rearmed by every progress event', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    let progress: (bytes: number) => void = () => {};
    phone.serve(
      urlB,
      (api) => {
        progress = api.progress;
        return new Promise(() => {});
      },
      ok('BBBBBB'),
    );
    const result = run();
    await phone.advance(20_000);
    progress(1);
    await phone.advance(20_000); // 40 s after the start, 20 s after the news
    expect(phone.cancelCalls).toBe(0);
    await phone.advance(10_000);
    expect(phone.cancelCalls).toBe(1);
    await phone.advance(5_000);
    expect(await result).toEqual({ kind: 'ready' });
  });
});

describe('room on the phone', () => {
  it('refuses to start without room for the missing bytes plus 50 MB', async () => {
    const { phone, states, run } = setup();
    phone.serveZone(zone, contents);
    phone.space = SPARE_BYTES + 11;
    const result = await run();
    expect(result).toEqual({
      kind: 'no-space',
      neededBytes: SPARE_BYTES + 12,
      availableBytes: SPARE_BYTES + 11,
    });
    expect(phone.started).toEqual([]);
    expect(last(states)).toEqual(result);
  });

  it('counts only what is still to download', async () => {
    const { phone, run } = setup();
    phone.serveZone(zone, contents);
    phone.files.set(`${dir}/a.bin`, 'AAAA');
    phone.space = SPARE_BYTES + 8;
    expect(await run()).toEqual({ kind: 'ready' });
  });
});

describe('cancel', () => {
  it('stops the file in progress when the signal is aborted', async () => {
    const { phone, controller, run } = setup();
    phone.serveZone(zone, contents);
    phone.serve(urlB, hang());
    const result = run();
    await phone.advance(0);
    controller.abort();
    expect(await result).toEqual({ kind: 'cancelled' });
    expect(phone.cancelCalls).toBe(1);
    expect(phone.files.has(readyPath(zone))).toBe(false);
  });
});
