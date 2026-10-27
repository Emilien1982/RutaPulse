import { makeZone } from './fakeZoneOps';
import {
  buildZoneRows,
  formatFreeSpace,
  formatMegabytes,
  formatOsmDate,
  formatProgress,
  type DownloadEntry,
} from './zoneRow';
import { LOCAL_FORMAT, type ReadyMarker } from './zoneLayout';

const nancy = makeZone({ 'a.bin': 'AAAA' }, 'nancy');
const metz = makeZone({ 'a.bin': 'BBBB' }, 'metz');
const gerardmer = makeZone({ 'a.bin': 'CCCC' }, 'gerardmer');

const installedNancy: ReadyMarker = {
  localFormat: LOCAL_FORMAT,
  installedAt: '2026-10-24T10:12:31Z',
  zone: nancy,
};

describe('buildZoneRows', () => {
  it('puts a zone of the catalogue to download in "available"', () => {
    const rows = buildZoneRows([nancy], [], {});
    expect(rows.installed).toEqual([]);
    expect(rows.available).toHaveLength(1);
    expect(rows.available[0]).toMatchObject({
      id: 'nancy',
      name: 'Nancy',
      status: { kind: 'available' },
    });
    expect(rows.waitingForWifi).toBe(false);
  });

  it('puts an installed zone in "installed" and sums its size', () => {
    const rows = buildZoneRows([nancy, metz], [installedNancy], {});
    expect(rows.installed.map((r) => [r.id, r.status.kind])).toEqual([
      ['nancy', 'ready'],
    ]);
    expect(rows.installedBytes).toBe(nancy.totalBytes);
    expect(rows.available.map((r) => r.id)).toEqual(['metz']);
  });

  it('keeps the catalogue order', () => {
    const rows = buildZoneRows([gerardmer, metz, nancy], [], {});
    expect(rows.available.map((r) => r.id)).toEqual([
      'gerardmer',
      'metz',
      'nancy',
    ]);
  });

  it('shows installed zones and downloads when the catalogue is unreachable', () => {
    const downloads: Record<string, DownloadEntry> = {
      metz: { zone: metz, state: { kind: 'queued' } },
    };
    const rows = buildZoneRows([], [installedNancy], downloads);
    expect(rows.installed.map((r) => r.id)).toEqual(['nancy']);
    expect(rows.available.map((r) => r.status.kind)).toEqual(['queued']);
  });

  it('maps each state of a download to a status', () => {
    const entry = (
      state: DownloadEntry['state'],
    ): Record<string, DownloadEntry> => ({
      nancy: { zone: nancy, state },
    });
    const status = (state: DownloadEntry['state']) =>
      buildZoneRows([nancy], [], entry(state)).available[0].status;

    expect(status({ kind: 'queued' })).toEqual({ kind: 'queued' });
    expect(
      status({ kind: 'downloading', doneBytes: 2, totalBytes: 4 }),
    ).toEqual({
      kind: 'downloading',
      doneBytes: 2,
      totalBytes: 4,
    });
    expect(
      status({
        kind: 'waiting',
        reason: 'no-wifi',
        doneBytes: 2,
        totalBytes: 4,
      }),
    ).toEqual({
      kind: 'waiting',
      reason: 'no-wifi',
      doneBytes: 2,
      totalBytes: 4,
    });
    expect(
      status({
        kind: 'failed',
        failedPath: 'a.bin',
        doneBytes: 2,
        totalBytes: 4,
      }),
    ).toEqual({ kind: 'failed', doneBytes: 2, totalBytes: 4 });
    expect(
      status({ kind: 'no-space', neededBytes: 9, availableBytes: 1 }),
    ).toEqual({ kind: 'no-space', neededBytes: 9 });
    expect(status({ kind: 'cancelled' })).toEqual({ kind: 'available' });
  });

  it('asks for the Wi-Fi banner only when a download waits for the Wi-Fi', () => {
    const waiting = (reason: 'no-wifi' | 'no-network') =>
      buildZoneRows([metz], [], {
        metz: {
          zone: metz,
          state: { kind: 'waiting', reason, doneBytes: 0, totalBytes: 4 },
        },
      }).waitingForWifi;
    expect(waiting('no-wifi')).toBe(true);
    expect(waiting('no-network')).toBe(false);
  });

  it('shows a zone that just became ready as installed', () => {
    const rows = buildZoneRows([nancy], [], {
      nancy: { zone: nancy, state: { kind: 'ready' } },
    });
    expect(rows.installed.map((r) => r.id)).toEqual(['nancy']);
  });
});

describe('formats', () => {
  it('writes sizes in decimal megabytes', () => {
    expect(formatMegabytes(110_962_386)).toBe('111 Mo');
    expect(formatProgress(40_400_000, 95_000_000)).toBe('40 Mo sur 95');
  });

  it('writes the free space in gigabytes with a comma', () => {
    expect(formatFreeSpace(23_400_000_000)).toBe('23,4 Go libres');
  });

  it('writes the date of the data in French', () => {
    expect(formatOsmDate('2026-10-22T20:21:33Z')).toBe('22 oct.');
    expect(formatOsmDate('2026-01-05T00:00:00Z')).toBe('5 janv.');
  });
});
