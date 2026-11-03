// Tests of the update of a zone (phase 5b, T4), written by the tester from the
// spec (C9, C10, C11) and from ADR 0018 (sections 3, 4, 6), not from the code.
//
// External source of the "general" case: the catalogue published on
//   https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json
// Read on 2 November 2026 (v3, release zone-nancy-v3): nancy version 3, osmDate
// 2026-10-22T20:21:33Z, totalBytes 110962386 = `fixtures/catalogueV3.json`.
// Read again later the same day (v4, release zone-nancy-v4): nancy version 4,
// osmDate 2026-11-01T21:21:36Z, totalBytes 111360850, 9 files
// = `fixtures/catalogueV4Testeur.json`.
import catalogueV3 from './fixtures/catalogueV3.json';
import catalogueV4 from './fixtures/catalogueV4Testeur.json';

import { pickActiveZone } from './activeZone';
import { parseCatalogue, type Zone } from './catalogue';
import {
  downloadZone,
  requestZone,
  SPARE_BYTES,
  type DownloadState,
} from './downloadZone';
import {
  corrupt,
  createFakePhone,
  hang,
  makeZone,
  type FakePhone,
} from './fakeZoneOps';
import {
  cancelZone,
  oldVersions,
  removeOldVersions,
  scanZones,
} from './installedZones';
import {
  filePath,
  planPath,
  readyPath,
  serializePlan,
  serializeReady,
  versionDir,
  type ReadyMarker,
} from './zoneLayout';
import {
  buildZoneRows,
  formatMegabytes,
  formatOsmDate,
  type DownloadEntry,
} from './zoneRow';
import { createZoneService } from './zoneService';

const realV3 = parseCatalogue(catalogueV3).zones[0];
const realV4: Zone = parseCatalogue(catalogueV4).zones[0];

const ready = (zone: Zone, at = '2026-10-24T10:12:31Z'): ReadyMarker => ({
  localFormat: 1,
  installedAt: at,
  zone,
});

// ---------------------------------------------------------------- C9

describe('C9, the Zones rows signal a newer version of the catalogue', () => {
  it('the real catalogue numbers: 111 Mo, 22 oct. (general case, external source)', () => {
    expect(realV3.totalBytes).toBe(110_962_386);
    expect(formatMegabytes(realV3.totalBytes)).toBe('111 Mo');
    expect(formatOsmDate(realV3.osmDate)).toBe('22 oct.');
    expect(formatOsmDate(realV4.osmDate)).toBe('1 nov.');
  });

  it('v3 ready + catalogue v4: the card of v3 carries an "available" update', () => {
    const rows = buildZoneRows([realV4], [ready(realV3)], {});
    expect(rows.available).toEqual([]);
    expect(rows.installed).toHaveLength(1);
    const row = rows.installed[0];
    // The top of the card is still the version in service.
    expect(row.status).toEqual({ kind: 'ready' });
    expect(row.totalBytes).toBe(110_962_386);
    expect(row.osmDate).toBe('2026-10-22T20:21:33Z');
    expect(row.update).toEqual({ kind: 'available', zone: realV4 });
    expect(rows.installedBytes).toBe(110_962_386);
    expect(rows.waitingForWifi).toBe(false);
  });

  it.each([
    ['no catalogue (offline)', [] as Zone[]],
    ['same version', [realV3]],
    [
      'an older catalogue (release withdrawn)',
      [{ ...realV3, version: 2 } as Zone],
    ],
  ])('%s: nothing is signalled', (_name, catalogue) => {
    const rows = buildZoneRows(catalogue, [ready(realV3)], {});
    expect(rows.installed).toHaveLength(1);
    expect(rows.installed[0].update).toBeUndefined();
  });

  it('a zone that is not ready never gets an update part', () => {
    const rows = buildZoneRows([realV4], [], {});
    expect(rows.installed).toEqual([]);
    expect(rows.available).toHaveLength(1);
    expect(rows.available[0].update).toBeUndefined();
  });

  it('with v3 and v4 both ready, only v4 shows, once, with its own size and date', () => {
    const rows = buildZoneRows(
      [realV4],
      [ready(realV3), ready(realV4, '2026-11-02T11:00:00Z')],
      {},
    );
    expect(rows.installed).toHaveLength(1);
    expect(rows.installed[0].osmDate).toBe('2026-11-01T21:21:36Z');
    expect(rows.installed[0].update).toBeUndefined();
    // "Sur le téléphone" counts the greatest version only.
    expect(rows.installedBytes).toBe(realV4.totalBytes);
  });

  const entry = (state: DownloadEntry['state']): DownloadEntry => ({
    zone: realV4,
    state,
  });

  it('a running update keeps the v3 card and reports its state', () => {
    const rows = buildZoneRows([realV4], [ready(realV3)], {
      nancy: entry({
        kind: 'downloading',
        doneBytes: 47_000_000,
        totalBytes: realV4.totalBytes,
      }),
    });
    expect(rows.installed[0].status).toEqual({ kind: 'ready' });
    expect(rows.installed[0].update).toMatchObject({
      kind: 'running',
      status: { kind: 'downloading', doneBytes: 47_000_000 },
    });
    expect(rows.installedBytes).toBe(realV3.totalBytes);
  });

  it('waiting for the Wi-Fi: the banner flag is raised', () => {
    const rows = buildZoneRows([realV4], [ready(realV3)], {
      nancy: entry({
        kind: 'waiting',
        reason: 'no-wifi',
        doneBytes: 0,
        totalBytes: realV4.totalBytes,
      }),
    });
    expect(rows.waitingForWifi).toBe(true);
    expect(rows.installed[0].update).toMatchObject({
      kind: 'running',
      status: { kind: 'waiting', reason: 'no-wifi' },
    });
  });

  it('waiting for the network (not the Wi-Fi rule): no banner', () => {
    const rows = buildZoneRows([realV4], [ready(realV3)], {
      nancy: entry({
        kind: 'waiting',
        reason: 'no-network',
        doneBytes: 0,
        totalBytes: realV4.totalBytes,
      }),
    });
    expect(rows.waitingForWifi).toBe(false);
  });

  it.each([
    ['queued', { kind: 'queued' } as const],
    [
      'failed',
      {
        kind: 'failed',
        failedPath: 'map.pmtiles',
        doneBytes: 47_000_000,
        totalBytes: realV4.totalBytes,
      } as const,
    ],
    [
      'no-space',
      {
        kind: 'no-space',
        neededBytes: 161_360_850,
        availableBytes: 1,
      } as const,
    ],
  ])('state %s of the update is kept on the card of v3', (kind, state) => {
    const rows = buildZoneRows([realV4], [ready(realV3)], {
      nancy: entry(state),
    });
    expect(rows.installed[0].update).toMatchObject({
      kind: 'running',
      status: { kind },
    });
    expect(rows.installed[0].status).toEqual({ kind: 'ready' });
  });

  it('after a cancel, the card goes back to "update available"', () => {
    const rows = buildZoneRows([realV4], [ready(realV3)], {
      nancy: entry({ kind: 'cancelled' }),
    });
    expect(rows.installed[0].update).toEqual({
      kind: 'available',
      zone: realV4,
    });
  });
});

// ---------------------------------------------------------------- C10

const contents3 = {
  'a.bin': 'AAAA',
  'elevation/N48/b.hgt': 'BBBBBB',
  'z.json': 'ZZ',
};
const contents4 = {
  'a.bin': 'CCCCC',
  'elevation/N48/b.hgt': 'DDDDDDD',
  'z.json': 'EEE',
};
const z3 = makeZone(contents3, 'nancy', 3);
const z4 = makeZone(contents4, 'nancy', 4);
const [, urlB4] = z4.files.map((f) => f.url);

/** v3 installed, with its files, as a first download leaves it. */
function installed(
  phone: FakePhone,
  zone: Zone,
  contents: object,
  at?: string,
) {
  phone.files.set(
    readyPath(zone),
    serializeReady(zone, at ?? '2026-10-24T10:12:31Z'),
  );
  for (const [path, text] of Object.entries(contents)) {
    phone.files.set(filePath(zone, { path }), text as string);
  }
}

const v3Snapshot = (phone: FakePhone) =>
  [...phone.files.entries()]
    .filter(([key]) => key.startsWith('zones/nancy/v3/'))
    .sort(([a], [b]) => a.localeCompare(b));

describe('C10, safe update (downloadZone with a fake disk and network)', () => {
  it('writes the new version in its own folder; v3 is intact at every step and after', async () => {
    const phone = createFakePhone();
    installed(phone, z3, contents3);
    const before = v3Snapshot(phone);
    phone.serveZone(z4, contents4);
    await requestZone(z4, phone.ops);

    const seen: string[] = [];
    const result = await downloadZone(
      z4,
      phone.ops,
      new AbortController().signal,
      () => {
        if (JSON.stringify(v3Snapshot(phone)) !== JSON.stringify(before)) {
          seen.push('v3 changed');
        }
      },
    );
    expect(result).toEqual({ kind: 'ready' });
    expect(seen).toEqual([]);
    expect(v3Snapshot(phone)).toEqual(before);

    const outside = [...phone.files.keys()].filter(
      (k) =>
        !k.startsWith('zones/nancy/v3/') && !k.startsWith('zones/nancy/v4/'),
    );
    expect(outside).toEqual([]);
    expect(phone.files.get('zones/nancy/v4/elevation/N48/b.hgt')).toBe(
      'DDDDDDD',
    );
    expect(phone.files.has(planPath(z4))).toBe(false);

    // Both are ready: the one in use is the greatest, and every path of a zone
    // belongs to one version only.
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed.map((m) => m.zone.version).sort()).toEqual([3, 4]);
    const picked = pickActiveZone(scan.installed);
    expect(picked?.version).toBe(4);
    for (const file of picked?.files ?? []) {
      const path = filePath(picked as Zone, file);
      expect(path.startsWith(`${versionDir(z4)}/`)).toBe(true);
      expect(path).not.toContain('/v3/');
    }
  });

  it('while v4 downloads, v3 is the only ready version and stays the zone in use', async () => {
    const phone = createFakePhone();
    installed(phone, z3, contents3);
    phone.serveZone(z4, contents4);
    phone.serve(urlB4, hang('DD'));
    await requestZone(z4, phone.ops);
    const controller = new AbortController();
    const running = downloadZone(z4, phone.ops, controller.signal, () => {});
    await phone.advance(10);

    const scan = await scanZones(phone.ops, false);
    expect(scan.installed.map((m) => m.zone.version)).toEqual([3]);
    expect(pickActiveZone(scan.installed)?.version).toBe(3);
    expect(scan.interrupted.map((z) => z.version)).toEqual([4]);
    expect(phone.files.has(readyPath(z4))).toBe(false);

    controller.abort();
    expect(await running).toEqual({ kind: 'cancelled' });
  });

  it('cancel erases the new version only', async () => {
    const phone = createFakePhone();
    installed(phone, z3, contents3);
    const before = v3Snapshot(phone);
    phone.serveZone(z4, contents4);
    phone.serve(urlB4, hang('DD'));
    await requestZone(z4, phone.ops);
    const controller = new AbortController();
    const running = downloadZone(z4, phone.ops, controller.signal, () => {});
    await phone.advance(10);
    controller.abort();
    await running;
    await cancelZone(z4, phone.ops);

    expect([...phone.files.keys()].some((k) => k.includes('/v4'))).toBe(false);
    expect(v3Snapshot(phone)).toEqual(before);
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed.map((m) => m.zone.version)).toEqual([3]);
    expect(scan.interrupted).toEqual([]);
  });

  it('wrong fingerprint 3 times: the update fails, v3 stays ready and in use', async () => {
    const phone = createFakePhone();
    installed(phone, z3, contents3);
    const before = v3Snapshot(phone);
    phone.serveZone(z4, contents4);
    phone.serve(urlB4, corrupt('DDDDDDD'));
    await requestZone(z4, phone.ops);

    const result = downloadZone(
      z4,
      phone.ops,
      new AbortController().signal,
      () => {},
    );
    await phone.advance(60_000);
    expect(await result).toMatchObject({ kind: 'failed' });

    expect(phone.files.has(readyPath(z4))).toBe(false);
    expect(v3Snapshot(phone)).toEqual(before);
    const scan = await scanZones(phone.ops, false);
    expect(pickActiveZone(scan.installed)?.version).toBe(3);
    expect(scan.installed.map((m) => m.zone.version)).toEqual([3]);
  });

  it('a cut in the middle: after a restart the scan offers v4 to resume, v3 still serves', async () => {
    const phone = createFakePhone();
    installed(phone, z3, contents3);
    phone.serveZone(z4, contents4);
    phone.serve(urlB4, hang('DD'));
    await requestZone(z4, phone.ops);
    const controller = new AbortController();
    void downloadZone(z4, phone.ops, controller.signal, () => {});
    await phone.advance(10);
    // The app is killed here: nothing more is run. The disk is all that is left.
    const scan = await scanZones(phone.ops, true);
    expect(scan.interrupted.map((z) => z.version)).toEqual([4]);
    expect(scan.installed.map((m) => m.zone.version)).toEqual([3]);
    // The folder with the plan is not a leftover: it was not erased.
    expect(phone.files.has(planPath(z4))).toBe(true);
    // Resume: a.bin is already there and checked, only the rest is fetched.
    phone.started.length = 0;
    phone.serve(urlB4, (api) => {
      api.write('DDDDDDD');
    });
    const resumed = await downloadZone(
      scan.interrupted[0],
      phone.ops,
      new AbortController().signal,
      () => {},
    );
    expect(resumed).toEqual({ kind: 'ready' });
    expect(phone.started).not.toContain(z4.files[0].url);
    controller.abort();
  });

  describe('a leftover plan of a smaller version (ADR 0018, section 3)', () => {
    function diskWith(...steps: (() => void)[]) {
      const phone = createFakePhone();
      steps.forEach((s) => s());
      return phone;
    }

    it('v4 ready + .plan.json of v3: erased at launch, not resumed', async () => {
      const phone = diskWith();
      installed(phone, z4, contents4);
      phone.files.set(planPath(z3), serializePlan(z3));
      phone.files.set(filePath(z3, { path: 'a.bin' }), 'AA');

      const scan = await scanZones(phone.ops, true);
      expect(scan.interrupted).toEqual([]);
      expect([...phone.files.keys()].some((k) => k.includes('/v3'))).toBe(
        false,
      );
      expect(phone.files.has(readyPath(z4))).toBe(true);
    });

    it('without the launch flag, the scan reports nothing to resume and erases nothing', async () => {
      const phone = diskWith();
      installed(phone, z4, contents4);
      phone.files.set(planPath(z3), serializePlan(z3));
      const scan = await scanZones(phone.ops, false);
      expect(scan.interrupted).toEqual([]);
      expect(phone.files.has(planPath(z3))).toBe(true);
    });

    it('v3 ready + plan of v4: resumed (a greater version is not a leftover)', async () => {
      const phone = diskWith();
      installed(phone, z3, contents3);
      phone.files.set(planPath(z4), serializePlan(z4));
      const scan = await scanZones(phone.ops, true);
      expect(scan.interrupted.map((z) => z.version)).toEqual([4]);
      expect(phone.files.has(planPath(z4))).toBe(true);
    });
  });

  describe('a version without a readable .ready.json is never ready', () => {
    const v4Dir = 'zones/nancy/v4';
    it.each([
      ['files only', (p: FakePhone) => p.files.set(`${v4Dir}/a.bin`, 'CCCCC')],
      [
        'plan only',
        (p: FakePhone) => p.files.set(planPath(z4), serializePlan(z4)),
      ],
      [
        'a broken marker',
        (p: FakePhone) => p.files.set(readyPath(z4), '{"localFor'),
      ],
      [
        'a marker that says version 3',
        (p: FakePhone) =>
          p.files.set(
            readyPath(z4),
            serializeReady(z3, '2026-10-24T10:12:31Z'),
          ),
      ],
      [
        'a marker without installedAt (a plan under the name of a marker)',
        (p: FakePhone) => p.files.set(readyPath(z4), serializePlan(z4)),
      ],
    ])('%s', async (_name, build) => {
      const phone = createFakePhone();
      installed(phone, z3, contents3);
      build(phone);
      const scan = await scanZones(phone.ops, false);
      expect(scan.installed.map((m) => m.zone.version)).toEqual([3]);
      expect(pickActiveZone(scan.installed)?.version).toBe(3);
      const rows = buildZoneRows([z4], scan.installed, {});
      expect(rows.installed).toHaveLength(1);
      expect(rows.installed[0].osmDate).toBe(z3.osmDate);
    });
  });
});

describe('C10 / C9, room for the update (ADR 0018, section 3, "Place")', () => {
  it('real catalogue: needs the whole v4 + 50 Mo, v3 on the disk is not counted', async () => {
    // 111 360 850 (published v4 total) + 50 000 000 (ADR 0013 spare) = 161 360 850
    const phone = createFakePhone();
    installed(phone, realV3, {});
    phone.space = 161_360_849;
    const states: DownloadState[] = [];
    const last = await downloadZone(
      realV4,
      phone.ops,
      new AbortController().signal,
      (s) => states.push(s),
    );
    expect(SPARE_BYTES).toBe(50_000_000);
    expect(last).toMatchObject({
      kind: 'no-space',
      neededBytes: 161_360_850,
      availableBytes: 161_360_849,
    });
    expect(formatMegabytes(161_360_850)).toBe('161 Mo');
    // Nothing was written and v3 is still ready.
    expect(phone.started).toEqual([]);
    expect(phone.files.has(readyPath(realV3))).toBe(true);
    expect(phone.files.has(readyPath(realV4))).toBe(false);
  });

  it('exactly enough room (total + 50 Mo) goes through', async () => {
    const phone = createFakePhone();
    installed(phone, z3, contents3);
    phone.serveZone(z4, contents4);
    phone.space = z4.totalBytes + 50_000_000;
    const last = await downloadZone(
      z4,
      phone.ops,
      new AbortController().signal,
      () => {},
    );
    expect(last).toEqual({ kind: 'ready' });
  });
});

// ---------------------------------------------------------------- C11 (core)

describe('C11, erasing the old version (removeOldVersions, oldVersions)', () => {
  function twoVersions() {
    const phone = createFakePhone();
    installed(phone, z3, contents3, '2026-10-24T10:12:31Z');
    installed(phone, z4, contents4, '2026-11-02T10:12:31Z');
    return phone;
  }
  const markers = (phone: FakePhone) =>
    scanZones(phone.ops, false).then((s) => s.installed);

  it('zone in service not known yet: nothing is erased', async () => {
    const phone = twoVersions();
    await removeOldVersions(phone.ops, createZoneService());
    expect(phone.files.has(readyPath(z3))).toBe(true);
    expect(phone.files.has(readyPath(z4))).toBe(true);
  });

  it('zone in service is v3 (held): v3 is kept even if v4 is ready', async () => {
    const phone = twoVersions();
    const service = createZoneService();
    service.update(await markers(phone).then((m) => [m[0]]));
    const hold = service.hold();
    service.update(await markers(phone));
    expect(service.current()?.version).toBe(3);
    await removeOldVersions(phone.ops, service);
    expect(phone.files.has(readyPath(z3))).toBe(true);
    expect(phone.files.has('zones/nancy/v3/a.bin')).toBe(true);
    hold.release();
  });

  it('zone in service is v4: v3 goes, v4 stays, a v5 on its way and another zone are not touched', async () => {
    const phone = twoVersions();
    const z5 = makeZone({ 'a.bin': 'FFFFFF' }, 'nancy', 5);
    phone.files.set(planPath(z5), serializePlan(z5));
    phone.files.set(filePath(z5, { path: 'a.bin' }), 'FF');
    const metz = makeZone({ 'a.bin': 'MM' }, 'metz', 1);
    installed(phone, metz, { 'a.bin': 'MM' }, '2026-01-01T00:00:00Z');

    const service = createZoneService();
    const all = await markers(phone);
    service.update(all);
    expect(service.current()?.version).toBe(4);
    await removeOldVersions(phone.ops, service);

    expect(
      [...phone.files.keys()].some((k) => k.startsWith('zones/nancy/v3')),
    ).toBe(false);
    expect(phone.files.has(readyPath(z4))).toBe(true);
    expect(phone.files.get(filePath(z5, { path: 'a.bin' }))).toBe('FF');
    expect(phone.files.has(planPath(z5))).toBe(true);
    expect(phone.files.has(readyPath(metz))).toBe(true);
  });

  it('oldVersions: nothing to erase with a single ready version', () => {
    expect(oldVersions([ready(z3)], z3)).toEqual([]);
  });
});

describe('C11, the zone service', () => {
  it('without hold: switches at once and tells the listeners in order of subscription', () => {
    const service = createZoneService();
    const log: string[] = [];
    service.subscribe(() => log.push(`first v${service.current()?.version}`));
    service.subscribe(() => log.push(`second v${service.current()?.version}`));
    service.update([ready(z3)]);
    log.length = 0;
    service.update([ready(z3), ready(z4)]);
    expect(log).toEqual(['first v4', 'second v4']);
  });

  it('with a hold: stays on v3; on release, takes the last list', () => {
    const service = createZoneService();
    service.update([ready(z3)]);
    const hold = service.hold();
    service.update([ready(z3), ready(z4)]);
    expect(service.current()?.version).toBe(3);
    hold.release();
    expect(service.current()?.version).toBe(4);
  });

  it('two holds, one released: still v3', () => {
    const service = createZoneService();
    service.update([ready(z3)]);
    const a = service.hold();
    const b = service.hold();
    service.update([ready(z3), ready(z4)]);
    a.release();
    expect(service.current()?.version).toBe(3);
    b.release();
    expect(service.current()?.version).toBe(4);
  });

  it('releasing the same hold twice does not release another one', () => {
    const service = createZoneService();
    service.update([ready(z3)]);
    const a = service.hold();
    const b = service.hold();
    service.update([ready(z3), ready(z4)]);
    a.release();
    a.release();
    expect(service.current()?.version).toBe(3);
    b.release();
  });
});
