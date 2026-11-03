// The "update" part of a ready zone (ADR 0018, section 3).
import { makeZone } from './fakeZoneOps';
import { buildZoneRows, type DownloadEntry } from './zoneRow';
import type { ReadyMarker } from './zoneLayout';

const v3 = makeZone({ 'a.bin': 'AAAA' }, 'nancy', 3);
const v4 = {
  ...makeZone({ 'a.bin': 'AAAAA' }, 'nancy', 4),
  osmDate: '2026-11-02T00:00:00Z',
};
const marker = (zone: typeof v3): ReadyMarker => ({
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00Z',
  zone,
});
const entry = (
  state: DownloadEntry['state'],
): Record<string, DownloadEntry> => ({
  nancy: { zone: v4, state },
});

describe('buildZoneRows, update part', () => {
  it('no part when the catalogue has the same version', () => {
    const rows = buildZoneRows([v3], [marker(v3)], {});
    expect(rows.installed[0].update).toBeUndefined();
  });

  it('available when the catalogue has a greater version', () => {
    const rows = buildZoneRows([v4], [marker(v3)], {});
    expect(rows.installed).toHaveLength(1);
    expect(rows.installed[0].status).toEqual({ kind: 'ready' });
    expect(rows.installed[0].totalBytes).toBe(v3.totalBytes);
    expect(rows.installed[0].update).toEqual({ kind: 'available', zone: v4 });
  });

  it('nothing without a catalogue (offline)', () => {
    const rows = buildZoneRows([], [marker(v3)], {});
    expect(rows.installed[0].update).toBeUndefined();
  });

  it('never goes back: a catalogue older than the phone shows nothing', () => {
    const rows = buildZoneRows([v3], [marker(v4)], {});
    expect(rows.installed[0].update).toBeUndefined();
    expect(rows.installed[0].totalBytes).toBe(v4.totalBytes);
  });

  it('shows only the greatest of two ready versions, counted once', () => {
    const rows = buildZoneRows([v4], [marker(v3), marker(v4)], {});
    expect(rows.installed).toHaveLength(1);
    expect(rows.installed[0].totalBytes).toBe(v4.totalBytes);
    expect(rows.installedBytes).toBe(v4.totalBytes);
    expect(rows.installed[0].update).toBeUndefined();
  });

  it.each([
    [{ kind: 'queued' }, { kind: 'queued' }],
    [
      { kind: 'downloading', doneBytes: 2, totalBytes: 5 },
      { kind: 'downloading', doneBytes: 2, totalBytes: 5 },
    ],
    [
      { kind: 'waiting', reason: 'no-network', doneBytes: 2, totalBytes: 5 },
      { kind: 'waiting', reason: 'no-network', doneBytes: 2, totalBytes: 5 },
    ],
    [
      { kind: 'no-space', neededBytes: 9, availableBytes: 1 },
      { kind: 'no-space', neededBytes: 9 },
    ],
    [
      { kind: 'failed', failedPath: 'a.bin', doneBytes: 2, totalBytes: 5 },
      { kind: 'failed', doneBytes: 2, totalBytes: 5 },
    ],
  ] as const)('the download %j is the state of the update', (state, status) => {
    const rows = buildZoneRows([v4], [marker(v3)], entry(state));
    expect(rows.installed[0].update).toEqual({
      kind: 'running',
      zone: v4,
      status,
    });
    expect(rows.available).toEqual([]);
  });

  it('a download waiting for the Wi-Fi raises the banner', () => {
    const rows = buildZoneRows(
      [v4],
      [marker(v3)],
      entry({
        kind: 'waiting',
        reason: 'no-wifi',
        doneBytes: 0,
        totalBytes: 5,
      }),
    );
    expect(rows.waitingForWifi).toBe(true);
  });

  it('a finished download shows no part, and no "available" either', () => {
    const rows = buildZoneRows([v4], [marker(v3)], entry({ kind: 'ready' }));
    expect(rows.installed[0].update).toBeUndefined();
  });

  it('a cancelled download goes back to "available"', () => {
    const rows = buildZoneRows(
      [v4],
      [marker(v3)],
      entry({ kind: 'cancelled' }),
    );
    expect(rows.installed[0].update).toEqual({ kind: 'available', zone: v4 });
  });

  it('a download is found even if the catalogue is missing', () => {
    const rows = buildZoneRows([], [marker(v3)], entry({ kind: 'queued' }));
    expect(rows.installed[0].update?.kind).toBe('running');
  });
});
