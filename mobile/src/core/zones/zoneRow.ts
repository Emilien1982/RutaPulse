// What the Zones screen shows for each zone: see ADR 0013, section 9.
// Built from the catalogue, the zones installed on the disk and the
// downloads in progress.

import type { TextKey } from '@/core/i18n/fr';
import { t } from '@/core/i18n/t';
import type { Zone } from './catalogue';
import type { DownloadState } from './downloadZone';
import type { ReadyMarker } from './zoneLayout';

/** A download known by the downloader: waiting its turn, or in this state. */
export type DownloadEntry = {
  zone: Zone;
  state: DownloadState | { kind: 'queued' };
};

export type RowStatus =
  | { kind: 'available' }
  | { kind: 'queued' }
  | { kind: 'downloading'; doneBytes: number; totalBytes: number }
  | {
      kind: 'waiting';
      reason: 'no-wifi' | 'no-network';
      doneBytes: number;
      totalBytes: number;
    }
  | { kind: 'no-space'; neededBytes: number }
  | { kind: 'failed'; doneBytes: number; totalBytes: number }
  | { kind: 'ready' };

/**
 * The "update" part of the card of a ready zone (mockup 41, screens 2 to 4):
 * a newer version of the catalogue, or its download. No part means no update.
 */
export type RowUpdate =
  | { kind: 'available'; zone: Zone }
  | {
      kind: 'running';
      zone: Zone;
      status: Exclude<RowStatus, { kind: 'available' | 'ready' }>;
    };

export type ZoneRow = {
  id: string;
  name: string;
  totalBytes: number;
  osmDate: string;
  status: RowStatus;
  /** Only on the card of a ready zone, and only when there is an update. */
  update?: RowUpdate;
};

export type ZoneRows = {
  /** Ready zones ("Sur le téléphone"). */
  installed: ZoneRow[];
  /** The others: to download, or on their way. */
  available: ZoneRow[];
  /** Sum of `totalBytes` of the ready zones, read from the markers. */
  installedBytes: number;
  /** True if some download waits for the Wi-Fi (banner of the mockup 41). */
  waitingForWifi: boolean;
};

function rowOf(zone: Zone, status: RowStatus, update?: RowUpdate): ZoneRow {
  const row: ZoneRow = {
    id: zone.id,
    name: zone.name,
    totalBytes: zone.totalBytes,
    osmDate: zone.osmDate,
    status,
  };
  return update ? { ...row, update } : row;
}

function statusOf(entry: DownloadEntry): RowStatus {
  const state = entry.state;
  switch (state.kind) {
    case 'queued':
      return { kind: 'queued' };
    case 'downloading':
      return {
        kind: 'downloading',
        doneBytes: state.doneBytes,
        totalBytes: state.totalBytes,
      };
    case 'waiting':
      return {
        kind: 'waiting',
        reason: state.reason,
        doneBytes: state.doneBytes,
        totalBytes: state.totalBytes,
      };
    case 'no-space':
      return { kind: 'no-space', neededBytes: state.neededBytes };
    case 'failed':
      return {
        kind: 'failed',
        doneBytes: state.doneBytes,
        totalBytes: state.totalBytes,
      };
    case 'ready':
      return { kind: 'ready' };
    case 'cancelled':
      return { kind: 'available' };
  }
}

/**
 * The update part of a ready zone (ADR 0018, section 3). A newer version is
 * offered when the catalogue has a version greater than every version on the
 * phone, ready or on its way. No catalogue, or an older one: nothing.
 */
function updateOf(
  installed: Zone,
  catalogueZone: Zone | undefined,
  entry: DownloadEntry | undefined,
): RowUpdate | undefined {
  if (entry && entry.zone.version > installed.version) {
    if (entry.state.kind === 'ready') return undefined;
    const status = statusOf(entry);
    if (status.kind !== 'available' && status.kind !== 'ready') {
      return { kind: 'running', zone: entry.zone, status };
    }
  }
  const onItsWay =
    entry && entry.state.kind !== 'cancelled' ? entry : undefined;
  const newest = Math.max(installed.version, onItsWay?.zone.version ?? 0);
  if (catalogueZone && catalogueZone.version > newest) {
    return { kind: 'available', zone: catalogueZone };
  }
  return undefined;
}

/**
 * Catalogue zones come first, in the order of the catalogue. A zone that is
 * not in the catalogue (no network, or removed from it) is still shown when
 * it is installed or on its way: its marker holds all that the screen needs.
 * Of several ready versions of a zone, only the greatest is shown.
 */
export function buildZoneRows(
  catalogueZones: Zone[],
  installed: ReadyMarker[],
  downloads: Record<string, DownloadEntry>,
): ZoneRows {
  const catalogueById = new Map(catalogueZones.map((z) => [z.id, z]));
  const zones = new Map<string, Zone>();
  for (const zone of catalogueZones) zones.set(zone.id, zone);
  for (const entry of Object.values(downloads)) {
    if (!zones.has(entry.zone.id)) zones.set(entry.zone.id, entry.zone);
  }
  const installedById = new Map<string, ReadyMarker>();
  for (const marker of installed) {
    const known = installedById.get(marker.zone.id);
    if (!known || marker.zone.version > known.zone.version) {
      installedById.set(marker.zone.id, marker);
    }
  }
  for (const marker of installedById.values()) {
    // The installed copy is the one on the phone: its numbers are the right ones.
    zones.set(marker.zone.id, marker.zone);
  }

  const rows: ZoneRows = {
    installed: [],
    available: [],
    installedBytes: 0,
    waitingForWifi: false,
  };
  for (const zone of zones.values()) {
    const entry = downloads[zone.id];
    const marker = installedById.get(zone.id);
    if (marker) {
      const update = updateOf(marker.zone, catalogueById.get(zone.id), entry);
      rows.installed.push(rowOf(zone, { kind: 'ready' }, update));
      rows.installedBytes += zone.totalBytes;
      if (
        update?.kind === 'running' &&
        update.status.kind === 'waiting' &&
        update.status.reason === 'no-wifi'
      ) {
        rows.waitingForWifi = true;
      }
      continue;
    }
    if (entry?.state.kind === 'ready') {
      rows.installed.push(rowOf(zone, { kind: 'ready' }));
      rows.installedBytes += zone.totalBytes;
      continue;
    }
    const status = entry ? statusOf(entry) : ({ kind: 'available' } as const);
    if (status.kind === 'waiting' && status.reason === 'no-wifi') {
      rows.waitingForWifi = true;
    }
    rows.available.push(rowOf(zone, status));
  }
  return rows;
}

/** 110 962 386 bytes: "111". Decimal megabytes, as the catalogue sizes. */
export function megabytes(bytes: number): number {
  return Math.round(bytes / 1_000_000);
}

export function formatMegabytes(bytes: number): string {
  return t('zones.megabytes', { n: megabytes(bytes) });
}

/** "23,4 Go libres" */
export function formatFreeSpace(bytes: number): string {
  const gigabytes = (bytes / 1_000_000_000).toFixed(1).replace('.', ',');
  return t('zones.freeSpace', {
    n: t('zones.gigabytes', { n: gigabytes }),
  });
}

/** "2026-10-22T20:21:33Z" gives "22 oct." */
export function formatOsmDate(osmDate: string): string {
  const [, month, day] = /^\d{4}-(\d{2})-(\d{2})T/.exec(osmDate) ?? [];
  if (!month || !day) return osmDate;
  const key = `zones.month.${Number(month)}` as TextKey;
  return t('zones.date', { day: Number(day), month: t(key) });
}

/** "40 Mo sur 95" */
export function formatProgress(doneBytes: number, totalBytes: number): string {
  return t('zones.progress', {
    done: megabytes(doneBytes),
    total: megabytes(totalBytes),
  });
}
