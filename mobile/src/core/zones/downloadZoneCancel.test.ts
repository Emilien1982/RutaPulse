import { downloadZone, type DownloadState } from './downloadZone';
import { createFakePhone, makeZone, ok } from './fakeZoneOps';
import { readyPath } from './zoneLayout';

const contents = { 'a.bin': 'AAAA' };
const zone = makeZone(contents);

function setup() {
  const phone = createFakePhone();
  const states: DownloadState[] = [];
  const controller = new AbortController();
  const run = () =>
    downloadZone(zone, phone.ops, controller.signal, (s) => states.push(s));
  let release = () => {};
  phone.shaGate = new Promise<void>((resolve) => (release = resolve));
  return { phone, states, controller, run, release: () => release() };
}

describe('cancel while the fingerprint is computed', () => {
  it('does not write the ready marker after the last file is downloaded', async () => {
    const { phone, controller, run, release } = setup();
    phone.serveZone(zone, contents);
    const result = run();
    // a.bin, the last file, is checked after its download: the gate holds that check back.
    await phone.advance(0);
    controller.abort();
    release();
    expect(await result).toEqual({ kind: 'cancelled' });
    expect(phone.files.has(readyPath(zone))).toBe(false);
  });

  it('does not write the ready marker when all the files were already there', async () => {
    const { phone, controller, run, release } = setup();
    phone.files.set('zones/nancy/v3/a.bin', 'AAAA');
    const result = run();
    await phone.advance(0);
    controller.abort();
    release();
    expect(await result).toEqual({ kind: 'cancelled' });
    expect(phone.files.has(readyPath(zone))).toBe(false);
  });
});

describe('progress after the end of a download', () => {
  it('is ignored: no state after ready', async () => {
    const phone = createFakePhone();
    const states: DownloadState[] = [];
    const progress: ((bytes: number) => void)[] = [];
    for (const f of zone.files) {
      phone.serve(f.url, (api) => {
        progress.push(api.progress);
        return ok('AAAA')(api);
      });
    }
    const result = await downloadZone(
      zone,
      phone.ops,
      new AbortController().signal,
      (s) => states.push(s),
    );
    expect(result).toEqual({ kind: 'ready' });
    progress.forEach((p) => p(1));
    await phone.advance(60_000);
    expect(states[states.length - 1]).toEqual({ kind: 'ready' });
    expect(phone.cancelCalls).toBe(0);
  });
});
