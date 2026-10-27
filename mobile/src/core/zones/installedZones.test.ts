import { createFakePhone, makeZone, type FakePhone } from './fakeZoneOps';
import { downloadZone } from './downloadZone';
import { cancelZone, deleteZone, scanZones } from './installedZones';
import {
  planPath,
  readyPath,
  serializePlan,
  serializeReady,
} from './zoneLayout';

const nancy = makeZone({ 'map.pmtiles': 'MMMMMMMM', 'zone.json': 'ZZ' });
const metz = makeZone({ 'map.pmtiles': 'mmmm' }, 'metz', 1);

async function install(
  phone: FakePhone,
  zone: typeof nancy,
  contents: Record<string, string>,
) {
  phone.serveZone(zone, contents);
  const result = await downloadZone(
    zone,
    phone.ops,
    new AbortController().signal,
    () => {},
  );
  expect(result).toEqual({ kind: 'ready' });
}

const usedBytes = (phone: FakePhone) =>
  [...phone.files.values()].reduce((sum, text) => sum + text.length, 0);

describe('suppression (C5)', () => {
  it('deleting a zone gives the room back and keeps the others', async () => {
    const phone = createFakePhone();
    await install(phone, nancy, {
      'map.pmtiles': 'MMMMMMMM',
      'zone.json': 'ZZ',
    });
    await install(phone, metz, { 'map.pmtiles': 'mmmm' });
    const before = usedBytes(phone);
    expect((await scanZones(phone.ops, false)).installed).toHaveLength(2);

    await deleteZone('nancy', phone.ops);

    const after = usedBytes(phone);
    expect(before - after).toBeGreaterThanOrEqual(nancy.totalBytes);
    expect(
      [...phone.files.keys()].some((k) => k.startsWith('zones/nancy')),
    ).toBe(false);
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed.map((m) => m.zone.id)).toEqual(['metz']);
  });

  it('deleting a zone erases every version', async () => {
    const phone = createFakePhone();
    phone.files.set('zones/nancy/v2/.ready.json', 'x');
    phone.files.set('zones/nancy/v3/map.pmtiles', 'x');
    await deleteZone('nancy', phone.ops);
    expect(phone.files.size).toBe(0);
  });

  it('cancelling erases only the folder of that version', async () => {
    const phone = createFakePhone();
    phone.files.set('zones/nancy/v2/.ready.json', 'x');
    phone.files.set('zones/nancy/v3/map.pmtiles', 'x');
    phone.files.set(planPath(nancy), 'x');
    await cancelZone(nancy, phone.ops);
    expect([...phone.files.keys()]).toEqual(['zones/nancy/v2/.ready.json']);
  });
});

describe('scanZones', () => {
  it('lists ready zones with their name, size and date, without network', async () => {
    const phone = createFakePhone();
    phone.files.set(
      readyPath(nancy),
      serializeReady(nancy, '2026-10-24T10:12:31Z'),
    );
    const { installed } = await scanZones(phone.ops, false);
    expect(installed).toHaveLength(1);
    expect(installed[0].zone.name).toBe('Nancy');
    expect(installed[0].zone.totalBytes).toBe(10);
    expect(installed[0].installedAt).toBe('2026-10-24T10:12:31Z');
  });

  it('a plan without ready marker is an interrupted download', async () => {
    const phone = createFakePhone();
    phone.files.set(planPath(nancy), serializePlan(nancy));
    phone.files.set('zones/nancy/v3/map.pmtiles', 'MMM');
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed).toEqual([]);
    expect(scan.interrupted).toEqual([nancy]);
  });

  it('a ready marker wins over a plan left behind', async () => {
    const phone = createFakePhone();
    phone.files.set(planPath(nancy), serializePlan(nancy));
    phone.files.set(
      readyPath(nancy),
      serializeReady(nancy, '2026-10-24T10:12:31Z'),
    );
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed).toHaveLength(1);
    expect(scan.interrupted).toEqual([]);
  });

  it('erases a folder without a readable marker only when asked', async () => {
    const phone = createFakePhone();
    phone.files.set('zones/old/v1/map.pmtiles', 'x');
    phone.files.set('zones/old/v2/.ready.json', 'not json');
    await scanZones(phone.ops, false);
    expect(phone.files.size).toBe(2);
    await scanZones(phone.ops, true);
    expect(phone.files.size).toBe(0);
  });

  it('ignores a marker that belongs to another folder', async () => {
    const phone = createFakePhone();
    phone.files.set(
      'zones/nancy/v4/.ready.json',
      serializeReady(nancy, '2026-10-24T10:12:31Z'),
    );
    const scan = await scanZones(phone.ops, false);
    expect(scan.installed).toEqual([]);
  });
});
