import type { Zone } from '@/core/zones/catalogue';
import type { DownloadEntry } from '@/core/zones/zoneRow';

import { updateOffer, updatePhase } from './updateOffer';

function zone(version: number): Zone {
  return {
    id: 'nancy',
    name: 'Nancy',
    version,
    bbox: { lonMin: 5, latMin: 48, lonMax: 6, latMax: 49 },
    osmDate: '2026-11-01T00:00:00Z',
    totalBytes: 108_000_000,
    files: [],
  };
}

const known = (zones: Zone[]) => ({ zones, offline: false });

describe('updateOffer', () => {
  it('offers the newer version of the catalogue', () => {
    expect(updateOffer(zone(5), known([zone(6)]), undefined)).toEqual({
      kind: 'update',
      zone: zone(6),
    });
  });

  it('says nothing can be done when the catalogue has no newer version', () => {
    expect(updateOffer(zone(6), known([zone(6)]), undefined)).toEqual({
      kind: 'none',
    });
    expect(updateOffer(zone(5), known([]), undefined)).toEqual({
      kind: 'none',
    });
  });

  it('says it is offline only when the reading failed or waits for a network', () => {
    expect(
      updateOffer(zone(5), { zones: undefined, offline: true }, undefined),
    ).toEqual({ kind: 'offline' });
  });

  it('says it is loading during the first reading, not offline', () => {
    expect(
      updateOffer(zone(5), { zones: undefined, offline: false }, undefined),
    ).toEqual({ kind: 'loading' });
  });

  it('keeps the zones it knows even when a later reading fails', () => {
    expect(
      updateOffer(zone(5), { zones: [zone(6)], offline: true }, undefined).kind,
    ).toBe('update');
  });

  it('says running or failed when a download of a newer version exists', () => {
    expect(updateOffer(zone(5), known([zone(6)]), 'running')).toEqual({
      kind: 'running',
    });
    expect(
      updateOffer(zone(5), { zones: undefined, offline: true }, 'failed'),
    ).toEqual({ kind: 'failed' });
  });
});

describe('updatePhase', () => {
  const entry = (
    state: DownloadEntry['state'],
    version = 6,
  ): DownloadEntry => ({
    zone: zone(version),
    state,
  });

  it('is running while queued, downloading or waiting', () => {
    expect(updatePhase(zone(5), entry({ kind: 'queued' }))).toBe('running');
    expect(
      updatePhase(
        zone(5),
        entry({ kind: 'downloading', doneBytes: 1, totalBytes: 2 }),
      ),
    ).toBe('running');
    expect(
      updatePhase(
        zone(5),
        entry({
          kind: 'waiting',
          reason: 'no-wifi',
          doneBytes: 1,
          totalBytes: 2,
        }),
      ),
    ).toBe('running');
  });

  it('is failed after a failure or a lack of space, not "running"', () => {
    expect(
      updatePhase(
        zone(5),
        entry({ kind: 'failed', failedPath: 'a', doneBytes: 1, totalBytes: 2 }),
      ),
    ).toBe('failed');
    expect(
      updatePhase(
        zone(5),
        entry({ kind: 'no-space', neededBytes: 9, availableBytes: 1 }),
      ),
    ).toBe('failed');
  });

  it('is undefined for no entry, a cancelled one, a ready one or an old version', () => {
    expect(updatePhase(zone(5), undefined)).toBeUndefined();
    expect(updatePhase(zone(5), entry({ kind: 'cancelled' }))).toBeUndefined();
    expect(updatePhase(zone(5), entry({ kind: 'queued' }, 5))).toBeUndefined();
  });
});
