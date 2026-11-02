// Several versions of a zone on the disk (ADR 0018, sections 3 and 4).

import { pickActiveZone } from './activeZone';
import { downloadZone } from './downloadZone';
import { createFakePhone, makeZone } from './fakeZoneOps';
import { oldVersions, removeOldVersions, scanZones } from './installedZones';
import {
  planPath,
  readyPath,
  serializePlan,
  serializeReady,
  type ReadyMarker,
} from './zoneLayout';
import { createZoneService } from './zoneService';

const contents3 = { 'a.bin': 'AAAA' };
const contents4 = { 'a.bin': 'AAAAA' };
const v3 = makeZone(contents3, 'nancy', 3);
const v4 = makeZone(contents4, 'nancy', 4);
const v5 = makeZone({ 'a.bin': 'AAAAAA' }, 'nancy', 5);
const metz = makeZone({ 'a.bin': 'MM' }, 'metz', 1);

const ready = (zone: typeof v3, installedAt: string): ReadyMarker => ({
  localFormat: 1,
  installedAt,
  zone,
});

describe('pickActiveZone with several versions', () => {
  it('takes v4 over v3 even if v3 was installed later (clock changed)', () => {
    const picked = pickActiveZone([
      ready(v4, '2026-11-02T10:00:00Z'),
      ready(v3, '2026-12-01T10:00:00Z'),
    ]);
    expect(picked?.version).toBe(4);
  });

  it('among different zones, takes the most recently installed', () => {
    const picked = pickActiveZone([
      ready(v4, '2026-11-02T10:00:00Z'),
      ready(metz, '2026-11-03T10:00:00Z'),
    ]);
    expect(picked?.id).toBe('metz');
  });

  it('a zone with an old version only counts by its greatest version', () => {
    const picked = pickActiveZone([
      ready(v3, '2026-12-01T10:00:00Z'),
      ready(v4, '2026-11-02T10:00:00Z'),
      ready(metz, '2026-11-03T10:00:00Z'),
    ]);
    expect(picked?.id).toBe('metz');
  });
});

describe('oldVersions', () => {
  const both = [
    ready(v3, '2026-10-01T00:00:00Z'),
    ready(v4, '2026-11-02T00:00:00Z'),
  ];

  it('v3 and v4 ready, v4 in service: the v3', () => {
    expect(oldVersions(both, v4)).toEqual([v3]);
  });

  it('v3 held in service: nothing', () => {
    expect(oldVersions(both, v3)).toEqual([]);
  });

  it('a v5 still downloading (not ready) is never listed', () => {
    expect(oldVersions(both, v4).map((z) => z.version)).not.toContain(5);
    expect(oldVersions([ready(v3, '2026-10-01T00:00:00Z')], v3)).toEqual([]);
  });

  it('keeps the other zones alone', () => {
    const list = [...both, ready(metz, '2026-11-03T00:00:00Z')];
    expect(oldVersions(list, metz)).toEqual([v3]);
  });
});

describe('downloadZone keeps the other versions', () => {
  it('after the marker of v4, v3 is still there', async () => {
    const phone = createFakePhone();
    phone.files.set(readyPath(v3), serializeReady(v3, '2026-10-01T00:00:00Z'));
    phone.files.set('zones/nancy/v3/a.bin', 'AAAA');
    phone.serveZone(v4, contents4);

    const result = await downloadZone(
      v4,
      phone.ops,
      new AbortController().signal,
      () => {},
    );

    expect(result).toEqual({ kind: 'ready' });
    expect(phone.files.has(readyPath(v3))).toBe(true);
    expect(phone.files.has('zones/nancy/v3/a.bin')).toBe(true);
    expect(phone.files.has(readyPath(v4))).toBe(true);
  });
});

describe('scanZones and the plan of a smaller version', () => {
  it('a plan below the ready version is a leftover: not resumed, erased at launch', async () => {
    const phone = createFakePhone();
    phone.files.set(readyPath(v4), serializeReady(v4, '2026-11-02T00:00:00Z'));
    phone.files.set(planPath(v3), serializePlan(v3));

    const kept = await scanZones(phone.ops, false);
    expect(kept.interrupted).toEqual([]);
    expect(phone.files.has(planPath(v3))).toBe(true);

    await scanZones(phone.ops, true);
    expect(phone.files.has(planPath(v3))).toBe(false);
    expect(phone.files.has(readyPath(v4))).toBe(true);
  });

  it('a plan above the ready version is resumed and kept', async () => {
    const phone = createFakePhone();
    phone.files.set(readyPath(v3), serializeReady(v3, '2026-10-01T00:00:00Z'));
    phone.files.set(planPath(v4), serializePlan(v4));

    const scan = await scanZones(phone.ops, true);

    expect(scan.interrupted.map((z) => z.version)).toEqual([4]);
    expect(scan.installed.map((m) => m.zone.version)).toEqual([3]);
    expect(phone.files.has(planPath(v4))).toBe(true);
  });
});

describe('removeOldVersions', () => {
  function setup() {
    const phone = createFakePhone();
    phone.files.set(readyPath(v3), serializeReady(v3, '2026-10-01T00:00:00Z'));
    phone.files.set('zones/nancy/v3/a.bin', 'AAAA');
    phone.files.set(readyPath(v4), serializeReady(v4, '2026-11-02T00:00:00Z'));
    phone.files.set('zones/nancy/v4/a.bin', 'AAAAA');
    phone.files.set(planPath(v5), serializePlan(v5));
    phone.files.set('zones/nancy/v5/a.bin', 'AA');
    return phone;
  }
  const markers = [
    ready(v3, '2026-10-01T00:00:00Z'),
    ready(v4, '2026-11-02T00:00:00Z'),
  ];

  it('erases v3 when v4 is in service, and never touches the download', async () => {
    const phone = setup();
    const service = createZoneService();
    service.update(markers);

    await removeOldVersions(phone.ops, service);

    expect([...phone.files.keys()].some((k) => k.includes('/v3/'))).toBe(false);
    expect(phone.files.has('zones/nancy/v4/a.bin')).toBe(true);
    expect(phone.files.has('zones/nancy/v5/a.bin')).toBe(true);
  });

  it('keeps v3 while a hold keeps it in service', async () => {
    const phone = setup();
    const service = createZoneService();
    service.update([markers[0]]);
    service.hold();
    service.update(markers);

    await removeOldVersions(phone.ops, service);

    expect(phone.files.has('zones/nancy/v3/a.bin')).toBe(true);
  });

  it('erases nothing while the zone in service is unknown', async () => {
    const phone = setup();
    await removeOldVersions(phone.ops, createZoneService());
    expect(phone.files.has('zones/nancy/v3/a.bin')).toBe(true);
  });
});
