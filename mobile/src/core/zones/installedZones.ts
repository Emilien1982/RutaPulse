// What is on the disk: ready zones, interrupted downloads, leftovers.
// See ADR 0013, sections 5 and 7.

import type { Zone } from './catalogue';
import {
  parseMarker,
  parseVersionDirName,
  planPath,
  readyPath,
  versionDir,
  zoneDir,
  ZONES_DIR,
  type ReadyMarker,
} from './zoneLayout';
import type { ZoneOps } from './zoneOps';
import type { ZoneService } from './zoneService';

export type DiskScan = {
  /** Zones with a readable `.ready.json`. */
  installed: ReadyMarker[];
  /** Zones with a `.plan.json` and no `.ready.json`: to resume. */
  interrupted: Zone[];
};

async function readMarker(
  ops: ZoneOps,
  path: string,
  id: string,
  version: number,
) {
  const marker = parseMarker(await ops.readText(path));
  const sameFolder = marker?.zone.id === id && marker.zone.version === version;
  return sameFolder ? marker : null;
}

/**
 * Reads the disk. A version folder without a readable marker is a leftover,
 * and so is a `.plan.json` of a version smaller than the ready version of the
 * same zone (ADR 0018, section 3). Leftovers are erased only if
 * `eraseLeftovers` is true (at launch, not while a download may be creating
 * its folder).
 */
export async function scanZones(
  ops: ZoneOps,
  eraseLeftovers: boolean,
): Promise<DiskScan> {
  const scan: DiskScan = { installed: [], interrupted: [] };
  for (const id of await ops.listDir(ZONES_DIR)) {
    const pending: number[] = [];
    let greatestReady = 0;
    for (const name of await ops.listDir(zoneDir(id))) {
      const version = parseVersionDirName(name);
      if (version === null) continue;
      const ready = await readMarker(
        ops,
        readyPath({ id, version }),
        id,
        version,
      );
      if (ready?.installedAt !== undefined) {
        scan.installed.push({ ...ready, installedAt: ready.installedAt });
        greatestReady = Math.max(greatestReady, version);
      } else {
        pending.push(version);
      }
    }
    for (const version of pending) {
      const folder = { id, version };
      const plan = await readMarker(ops, planPath(folder), id, version);
      if (plan && version > greatestReady) scan.interrupted.push(plan.zone);
      else if (eraseLeftovers) await ops.remove(versionDir(folder));
    }
  }
  return scan;
}

/**
 * The ready versions that nothing needs any more: smaller than the greatest
 * ready version of their zone, and not the zone in service. A version still
 * downloading is never in the list (ADR 0018, section 4).
 */
export function oldVersions(
  installed: ReadyMarker[],
  inService: Zone | null,
): Zone[] {
  const greatest = new Map<string, number>();
  for (const { zone } of installed) {
    greatest.set(zone.id, Math.max(greatest.get(zone.id) ?? 0, zone.version));
  }
  return installed
    .map((marker) => marker.zone)
    .filter(
      (zone) =>
        zone.version < (greatest.get(zone.id) ?? 0) &&
        !(inService?.id === zone.id && inService.version === zone.version),
    );
}

/**
 * Erases the old versions once the engine has left them. The zone in service
 * is read again just before erasing; if it is not known, nothing is erased.
 */
export async function removeOldVersions(
  ops: ZoneOps,
  service: ZoneService,
): Promise<void> {
  const { installed } = await scanZones(ops, false);
  const inService = service.current();
  if (inService === undefined) return;
  for (const zone of oldVersions(installed, inService)) {
    await ops.remove(versionDir(zone));
  }
}

/** Cross (cancel): erases the folder of this version. */
export function cancelZone(zone: Zone, ops: ZoneOps): Promise<void> {
  return ops.remove(versionDir(zone));
}

/** Menu "delete": erases the zone, all versions. */
export function deleteZone(id: string, ops: ZoneOps): Promise<void> {
  return ops.remove(zoneDir(id));
}
