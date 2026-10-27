// Downloads of zones, outside of the screens: see ADR 0013, sections 3, 4, 7
// and 9. One zone at a time, the others wait in a queue. The state lives in
// a TanStack Store (`zoneDownloads`) that the Zones screen reads. The network
// and the "Wi-Fi only" setting are listened to by `downloadZone`, through
// `ops.onConditionsChange`.

import { Store } from '@tanstack/react-store';

import type { Zone } from '@/core/zones/catalogue';
import { downloadZone, requestZone } from '@/core/zones/downloadZone';
import { cancelZone, deleteZone, scanZones } from '@/core/zones/installedZones';
import type { DownloadEntry } from '@/core/zones/zoneRow';
import type { ZoneOps } from '@/core/zones/zoneOps';

export const zoneDownloads = new Store<Record<string, DownloadEntry>>({});

export type ZoneDownloader = {
  /** Button "Télécharger": keeps the request on the disk, then queues it. */
  request: (zone: Zone) => Promise<void>;
  /** Button "Réessayer" after a failure or a lack of space. */
  retry: (id: string) => void;
  /** Cross: stops the file, erases the folder of this version. */
  cancel: (id: string) => Promise<void>;
  /** Menu "Supprimer": erases the zone, all versions. */
  remove: (id: string) => Promise<void>;
  /** At launch: resumes the downloads that a closed app left on the disk. */
  resumeInterrupted: () => Promise<void>;
};

/**
 * `onInstalledChange` is called after a zone is ready, cancelled or deleted,
 * so that the list of installed zones is read again. The entry of a finished
 * download leaves the store only once it has returned: the screen never sees
 * a hole between "downloading" and "ready".
 */
export function createZoneDownloader(
  ops: ZoneOps,
  onInstalledChange: () => Promise<void> | void,
  store: Store<Record<string, DownloadEntry>> = zoneDownloads,
): ZoneDownloader {
  const queue: string[] = [];
  let running: {
    id: string;
    controller: AbortController;
    ended: Promise<void>;
  } | null = null;

  const set = (entry: DownloadEntry) =>
    store.setState((prev) => ({ ...prev, [entry.zone.id]: entry }));
  const drop = (id: string) =>
    store.setState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  function enqueue(zone: Zone) {
    set({ zone, state: { kind: 'queued' } });
    queue.push(zone.id);
    pump();
  }

  function pump() {
    if (running) return;
    const id = queue.shift();
    if (id === undefined) return;
    const zone = store.get()[id]?.zone;
    if (!zone) return pump();
    const controller = new AbortController();
    const ended = run(zone, controller).finally(() => {
      running = null;
      pump();
    });
    running = { id, controller, ended };
  }

  async function run(zone: Zone, controller: AbortController) {
    try {
      // Idempotent: also covers a retry after a failed first write.
      await requestZone(zone, ops);
      const last = await downloadZone(zone, ops, controller.signal, (state) => {
        // After a cancel, the entry is already gone: do not bring it back.
        if (!controller.signal.aborted) set({ zone, state });
      });
      if (last.kind === 'ready') {
        await onInstalledChange();
        drop(zone.id);
      }
      // 'failed' and 'no-space' stay in the store, with their button.
    } catch {
      // Writing the marker failed (disk full, ...): show it as a failure.
      setFailed(zone);
    }
  }

  function setFailed(zone: Zone) {
    set({
      zone,
      state: {
        kind: 'failed',
        failedPath: '',
        doneBytes: 0,
        totalBytes: zone.totalBytes,
      },
    });
  }

  async function stopRunning(id: string) {
    if (running?.id !== id) return;
    running.controller.abort();
    await running.ended;
  }

  function leaveQueue(id: string) {
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
  }

  return {
    async request(zone) {
      if (store.get()[zone.id]) return;
      set({ zone, state: { kind: 'queued' } });
      try {
        await requestZone(zone, ops);
      } catch {
        // The plan could not be written: "Réessayer" is offered.
        setFailed(zone);
        return;
      }
      queue.push(zone.id);
      pump();
    },

    retry(id) {
      const entry = store.get()[id];
      if (!entry) return;
      if (entry.state.kind !== 'failed' && entry.state.kind !== 'no-space') {
        return;
      }
      enqueue(entry.zone);
    },

    async cancel(id) {
      const entry = store.get()[id];
      if (!entry) return;
      leaveQueue(id);
      await stopRunning(id);
      drop(id);
      await cancelZone(entry.zone, ops);
      await onInstalledChange();
    },

    async remove(id) {
      leaveQueue(id);
      await stopRunning(id);
      drop(id);
      await deleteZone(id, ops);
      await onInstalledChange();
    },

    async resumeInterrupted() {
      const scan = await scanZones(ops, true);
      await onInstalledChange();
      for (const zone of scan.interrupted) {
        if (!store.get()[zone.id]) enqueue(zone);
      }
    },
  };
}

let current: ZoneDownloader | null = null;

/** Called once by the component that starts the downloader. */
export function setZoneDownloader(downloader: ZoneDownloader | null) {
  current = downloader;
}

/** The downloader in service; the screens call it from their buttons. */
export function getZoneDownloader(): ZoneDownloader {
  if (!current) throw new Error('The zone downloader is not started');
  return current;
}
