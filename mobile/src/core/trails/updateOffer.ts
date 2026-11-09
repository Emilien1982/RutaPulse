// What the sheet of a circuit of an old zone can offer (mockup 12, screen 5
// and variants D to F). Pure: no React.

import type { Zone } from '@/core/zones/catalogue';
import type { DownloadEntry } from '@/core/zones/zoneRow';

/**
 * `running`: a newer version is on its way (queued, downloading, waiting).
 * `failed`: its download stopped (failure, no space left).
 * Undefined: no newer version is being downloaded.
 */
export type UpdatePhase = 'running' | 'failed';

/** The state of the download of a newer version of `zone`, if any. */
export function updatePhase(
  zone: Zone,
  entry: DownloadEntry | undefined,
): UpdatePhase | undefined {
  if (!entry || entry.zone.version <= zone.version) return undefined;
  switch (entry.state.kind) {
    case 'queued':
    case 'downloading':
    case 'waiting':
      return 'running';
    case 'failed':
    case 'no-space':
      return 'failed';
    default:
      return undefined;
  }
}

/** What is known of the catalogue: its zones, or why they are not known. */
export type CatalogueView = {
  zones: readonly Zone[] | undefined;
  /** True when the reading failed, or waits for a network. */
  offline: boolean;
};

/**
 * `update`: a newer version is in the catalogue, to download.
 * `running`, `failed`: see `UpdatePhase`.
 * `loading`: the catalogue is being read for the first time.
 * `offline`: the catalogue cannot be read, nobody can say.
 * `none`: the catalogue has no newer version.
 */
export type UpdateOffer =
  | { kind: 'update'; zone: Zone }
  | { kind: 'running' }
  | { kind: 'failed' }
  | { kind: 'loading' }
  | { kind: 'offline' }
  | { kind: 'none' };

export function updateOffer(
  zone: Zone,
  catalogue: CatalogueView,
  phase: UpdatePhase | undefined,
): UpdateOffer {
  if (phase) return { kind: phase };
  if (!catalogue.zones) {
    return { kind: catalogue.offline ? 'offline' : 'loading' };
  }
  const newest = catalogue.zones.find(
    (z) => z.id === zone.id && z.version > zone.version,
  );
  return newest ? { kind: 'update', zone: newest } : { kind: 'none' };
}
