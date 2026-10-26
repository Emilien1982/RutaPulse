import { makeZone } from './fakeZoneOps';
import {
  filePath,
  parentDir,
  parseMarker,
  parseVersionDirName,
  planPath,
  readyPath,
  serializePlan,
  serializeReady,
  versionDir,
  zoneDir,
} from './zoneLayout';

const zone = makeZone({
  'map.pmtiles': 'abc',
  'elevation/N48/N48E005.hgt': 'de',
});

describe('zoneLayout paths', () => {
  it('follows the tree of ADR 0013', () => {
    expect(zoneDir('nancy')).toBe('zones/nancy');
    expect(versionDir(zone)).toBe('zones/nancy/v3');
    expect(planPath(zone)).toBe('zones/nancy/v3/.plan.json');
    expect(readyPath(zone)).toBe('zones/nancy/v3/.ready.json');
    expect(filePath(zone, zone.files[1])).toBe(
      'zones/nancy/v3/elevation/N48/N48E005.hgt',
    );
    expect(parentDir('zones/nancy/v3/elevation/N48/a.hgt')).toBe(
      'zones/nancy/v3/elevation/N48',
    );
  });

  it('reads version folder names', () => {
    expect(parseVersionDirName('v3')).toBe(3);
    expect(parseVersionDirName('v12')).toBe(12);
    expect(parseVersionDirName('v0')).toBeNull();
    expect(parseVersionDirName('3')).toBeNull();
    expect(parseVersionDirName('.plan.json')).toBeNull();
  });
});

describe('markers', () => {
  it('round-trips a plan, without installedAt', () => {
    const marker = parseMarker(serializePlan(zone));
    expect(marker?.zone).toEqual(zone);
    expect(marker?.installedAt).toBeUndefined();
  });

  it('round-trips a ready marker, with installedAt', () => {
    const marker = parseMarker(serializeReady(zone, '2026-10-24T10:12:31Z'));
    expect(marker?.installedAt).toBe('2026-10-24T10:12:31Z');
    expect(marker?.zone).toEqual(zone);
  });

  it.each([
    null,
    '',
    '{',
    '[]',
    '{"localFormat":2,"zone":{}}',
    '{"localFormat":1}',
  ])('refuses the unreadable marker %p', (text) => {
    expect(parseMarker(text)).toBeNull();
  });
});
