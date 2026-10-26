// Paths (relative to the document folder), marker names and marker reading:
// see ADR 0013, sections 1 and 5. Full paths are never stored (iOS).

import { parseZone, type Zone } from './catalogue';

export const ZONES_DIR = 'zones';
export const PLAN_NAME = '.plan.json';
export const READY_NAME = '.ready.json';
export const LOCAL_FORMAT = 1;

export type Marker = {
  localFormat: number;
  installedAt?: string;
  zone: Zone;
};

export type ReadyMarker = Marker & { installedAt: string };

export function zoneDir(id: string): string {
  return `${ZONES_DIR}/${id}`;
}

export function versionDir(zone: { id: string; version: number }): string {
  return `${zoneDir(zone.id)}/v${zone.version}`;
}

export function planPath(zone: { id: string; version: number }): string {
  return `${versionDir(zone)}/${PLAN_NAME}`;
}

export function readyPath(zone: { id: string; version: number }): string {
  return `${versionDir(zone)}/${READY_NAME}`;
}

export function filePath(
  zone: { id: string; version: number },
  file: { path: string },
): string {
  return `${versionDir(zone)}/${file.path}`;
}

/** Folder that holds a file, relative to the document folder. */
export function parentDir(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

export function serializePlan(zone: Zone): string {
  return JSON.stringify({ localFormat: LOCAL_FORMAT, zone });
}

export function serializeReady(zone: Zone, installedAt: string): string {
  return JSON.stringify({ localFormat: LOCAL_FORMAT, installedAt, zone });
}

/** Returns null when the text is not a readable marker. */
export function parseMarker(text: string | null): Marker | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const o = value as Record<string, unknown>;
    if (o.localFormat !== LOCAL_FORMAT) return null;
    const zone = parseZone(o.zone);
    return typeof o.installedAt === 'string'
      ? { localFormat: LOCAL_FORMAT, installedAt: o.installedAt, zone }
      : { localFormat: LOCAL_FORMAT, zone };
  } catch {
    return null;
  }
}

/** Parses `v3` into 3; null for any other name. */
export function parseVersionDirName(name: string): number | null {
  const match = /^v([1-9]\d*)$/.exec(name);
  return match ? Number(match[1]) : null;
}
