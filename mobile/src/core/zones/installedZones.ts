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
 * Reads the disk. A version folder without a readable marker is a leftover:
 * it is erased only if `eraseLeftovers` is true (at launch, not while a
 * download may be creating its folder).
 */
export async function scanZones(
  ops: ZoneOps,
  eraseLeftovers: boolean,
): Promise<DiskScan> {
  const scan: DiskScan = { installed: [], interrupted: [] };
  for (const id of await ops.listDir(ZONES_DIR)) {
    for (const name of await ops.listDir(zoneDir(id))) {
      const version = parseVersionDirName(name);
      if (version === null) continue;
      const folder = { id, version };
      const ready = await readMarker(ops, readyPath(folder), id, version);
      if (ready?.installedAt !== undefined) {
        scan.installed.push({ ...ready, installedAt: ready.installedAt });
        continue;
      }
      const plan = await readMarker(ops, planPath(folder), id, version);
      if (plan) scan.interrupted.push(plan.zone);
      else if (eraseLeftovers) await ops.remove(versionDir(folder));
    }
  }
  return scan;
}

/** Cross (cancel): erases the folder of this version. */
export function cancelZone(zone: Zone, ops: ZoneOps): Promise<void> {
  return ops.remove(versionDir(zone));
}

/** Menu "delete": erases the zone, all versions. */
export function deleteZone(id: string, ops: ZoneOps): Promise<void> {
  return ops.remove(zoneDir(id));
}
