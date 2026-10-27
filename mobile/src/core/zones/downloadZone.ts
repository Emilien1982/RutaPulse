// Download of one zone, file by file: see ADR 0013, sections 3 to 5.
// No phone API here: everything goes through `ZoneOps`.
// Expected failures come back as a state. A failure of `ops` outside a file
// attempt (for example writing the marker) is thrown to the caller.

import type { Zone, ZoneFile } from './catalogue';
import { networkRule } from './networkRule';
import {
  filePath,
  parentDir,
  planPath,
  readyPath,
  serializePlan,
  serializeReady,
  versionDir,
  zoneDir,
} from './zoneLayout';
import type { ZoneOps } from './zoneOps';

export const WATCHDOG_MS = 30_000;
export const RETRY_DELAY_MS = 5_000;
export const MAX_ATTEMPTS = 3;
export const SPARE_BYTES = 50_000_000;

export type DownloadState =
  | { kind: 'downloading'; doneBytes: number; totalBytes: number }
  | {
      kind: 'waiting';
      reason: 'no-wifi' | 'no-network';
      doneBytes: number;
      totalBytes: number;
    }
  | { kind: 'no-space'; neededBytes: number; availableBytes: number }
  | {
      kind: 'failed';
      failedPath: string;
      doneBytes: number;
      totalBytes: number;
    }
  | { kind: 'ready' }
  | { kind: 'cancelled' };

/** Step 1: keep the request on disk, so that it survives a closed app. */
export async function requestZone(zone: Zone, ops: ZoneOps): Promise<void> {
  await ops.makeDir(versionDir(zone));
  await ops.writeText(planPath(zone), serializePlan(zone));
}

type Attempt =
  | { outcome: 'ok' }
  | { outcome: 'paused' }
  | { outcome: 'cancelled' }
  | { outcome: 'error' };

/**
 * Steps 2 to 5. Returns the last state: ready, cancelled, no-space or failed.
 * `signal` aborted means "cancel". The caller erases the folder if needed,
 * and must wait for the end of `downloadZone` before doing so: a late write
 * could otherwise recreate a folder with only `.ready.json` in it.
 */
export async function downloadZone(
  zone: Zone,
  ops: ZoneOps,
  signal: AbortSignal,
  onState: (state: DownloadState) => void,
): Promise<DownloadState> {
  const totalBytes = zone.totalBytes;
  let doneBytes = 0;
  const cancelled: DownloadState = { kind: 'cancelled' };

  const downloading = (written: number) =>
    onState({
      kind: 'downloading',
      doneBytes: doneBytes + written,
      totalBytes,
    });

  // Resume: keep the files that are already there, complete and correct.
  const missing: ZoneFile[] = [];
  downloading(0);
  for (const file of zone.files) {
    if (signal.aborted) return cancelled;
    if (await isVerified(zone, file, ops).catch(() => false)) {
      doneBytes += file.bytes;
      downloading(0);
    } else {
      missing.push(file);
    }
  }

  const neededBytes = totalBytes - doneBytes + SPARE_BYTES;
  const availableBytes = await ops.availableSpace();
  if (availableBytes < neededBytes) {
    const state: DownloadState = {
      kind: 'no-space',
      neededBytes,
      availableBytes,
    };
    onState(state);
    return state;
  }

  // Wait for a moment when the network rule allows the download.
  // Returns false if the download was cancelled meanwhile.
  async function waitForPermission(): Promise<boolean> {
    for (;;) {
      if (signal.aborted) return false;
      let wake = () => {};
      const woken = new Promise<void>((resolve) => (wake = resolve));
      const stop = ops.onConditionsChange(wake);
      signal.addEventListener('abort', wake);
      try {
        const decision = networkRule(
          await ops.getWifiOnly(),
          await ops.getNetwork(),
        );
        if (decision === 'allowed') return !signal.aborted;
        onState({
          kind: 'waiting',
          reason: decision,
          doneBytes,
          totalBytes,
        });
        await woken;
      } finally {
        stop();
        signal.removeEventListener('abort', wake);
      }
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const stop = ops.setTimer(ms, done);
      signal.addEventListener('abort', done);
      function done() {
        stop();
        signal.removeEventListener('abort', done);
        resolve();
      }
    });
  }

  async function attempt(file: ZoneFile): Promise<Attempt> {
    const path = filePath(zone, file);
    // Android keeps a partial file after a cut: always start from nothing.
    await ops.remove(path);
    await ops.makeDir(parentDir(path));

    let pausedByRule = false;
    let timedOut = false;
    let finished = false;
    let stopWatchdog = () => {};
    const handle = ops.startDownload(file.url, path, (written) => {
      if (finished) return;
      armWatchdog();
      downloading(written);
    });
    function armWatchdog() {
      stopWatchdog();
      stopWatchdog = ops.setTimer(WATCHDOG_MS, () => {
        timedOut = true;
        handle.cancel();
      });
    }
    const cancel = () => handle.cancel();
    const recheck = async () => {
      const decision = networkRule(
        await ops.getWifiOnly(),
        await ops.getNetwork(),
      );
      if (decision !== 'allowed') {
        pausedByRule = true;
        handle.cancel();
      }
    };
    const stopListening = ops.onConditionsChange(() => void recheck());
    signal.addEventListener('abort', cancel);
    if (signal.aborted) handle.cancel();
    armWatchdog();

    let failed = false;
    try {
      await handle.done;
    } catch {
      failed = true;
    } finally {
      finished = true;
      stopWatchdog();
      stopListening();
      signal.removeEventListener('abort', cancel);
    }

    if (signal.aborted) return { outcome: 'cancelled' };
    if (pausedByRule) return { outcome: 'paused' };
    if (failed || timedOut) return { outcome: 'error' };
    try {
      if (await isVerified(zone, file, ops)) return { outcome: 'ok' };
    } catch {
      // treated as a wrong file
    }
    await ops.remove(path);
    return { outcome: 'error' };
  }

  for (const file of missing) {
    let failures = 0;
    for (;;) {
      if (!(await waitForPermission())) return cancelled;
      downloading(0);
      let result: Attempt;
      try {
        result = await attempt(file);
      } catch {
        result = { outcome: 'error' };
      }
      if (result.outcome === 'cancelled') return cancelled;
      if (result.outcome === 'ok') {
        doneBytes += file.bytes;
        break;
      }
      if (result.outcome === 'error') {
        failures += 1;
        if (failures >= MAX_ATTEMPTS) {
          const state: DownloadState = {
            kind: 'failed',
            failedPath: file.path,
            doneBytes,
            totalBytes,
          };
          onState(state);
          return state;
        }
        if (!(await waitForPermission())) return cancelled;
        await sleep(RETRY_DELAY_MS);
        if (signal.aborted) return cancelled;
      }
    }
  }

  // Everything is checked: the marker is written last. No `await` between
  // this test and the write, so a cancel cannot slip in.
  if (signal.aborted) return cancelled;
  await ops.writeText(readyPath(zone), serializeReady(zone, ops.now()));
  await ops.remove(planPath(zone));
  for (const name of await ops.listDir(zoneDir(zone.id))) {
    if (name !== `v${zone.version}`)
      await ops.remove(`${zoneDir(zone.id)}/${name}`);
  }
  const ready: DownloadState = { kind: 'ready' };
  onState(ready);
  return ready;
}

/** Step 3.1 and 3.4: right size first, then right fingerprint. */
async function isVerified(
  zone: Zone,
  file: ZoneFile,
  ops: ZoneOps,
): Promise<boolean> {
  const path = filePath(zone, file);
  const size = await ops.fileSize(path);
  if (size === null) return false;
  if (size !== file.bytes) {
    await ops.remove(path);
    return false;
  }
  if ((await ops.sha256(path)) !== file.sha256) {
    await ops.remove(path);
    return false;
  }
  return true;
}
