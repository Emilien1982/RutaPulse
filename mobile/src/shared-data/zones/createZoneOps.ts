// The real operations of core/zones, on expo-file-system and expo-network.
// Paths from core/ are relative to the document folder (ADR 0013, section 1).

import { Directory, File, Paths } from 'expo-file-system';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

import type { ZoneOps } from '@/core/zones/zoneOps';

import { onSettingsChange, readSettings } from '../settings/settingsFile';

const file = (path: string) => new File(Paths.document, path);
const directory = (path: string) => new Directory(Paths.document, path);

export function createZoneOps(): ZoneOps {
  return {
    startDownload: (url, path, onProgress) => {
      // Foreground: a background download could go on over 4G (ADR 0013).
      const task = File.createDownloadTask(url, file(path), {
        sessionType: 'foreground',
        // iOS sends a BigInt at run time, although the type says number.
        onProgress: (data) => onProgress(Number(data.bytesWritten)),
      });
      return {
        done: task.downloadAsync().then((result) => {
          if (result === null) throw new Error('Download did not finish');
        }),
        cancel: () => task.cancel(),
      };
    },
    fileSize: async (path) => {
      const f = file(path);
      return f.exists ? f.size : null;
    },
    sha256: (path) => file(path).digest('SHA-256'),
    readText: async (path) => {
      const f = file(path);
      return f.exists ? await f.text() : null;
    },
    writeText: async (path, text) => {
      const f = file(path);
      f.create({ intermediates: true, overwrite: true });
      f.write(text);
    },
    makeDir: async (path) => {
      directory(path).create({ intermediates: true, idempotent: true });
    },
    listDir: async (path) => {
      const d = directory(path);
      return d.exists ? d.list().map((entry) => entry.name) : [];
    },
    remove: async (path) => {
      const info = Paths.info(Paths.document.uri, path);
      if (!info.exists) return;
      if (info.isDirectory) directory(path).delete();
      else file(path).delete();
    },
    availableSpace: async () => Paths.availableDiskSpace,
    getNetwork: async () => {
      const state = await getNetworkStateAsync();
      return {
        isConnected: state.isConnected ?? false,
        type: state.type ?? 'UNKNOWN',
      };
    },
    getWifiOnly: async () => (await readSettings()).wifiOnly,
    onConditionsChange: (listener) => {
      const network = addNetworkStateListener(listener);
      const stopSettings = onSettingsChange(listener);
      return () => {
        network.remove();
        stopSettings();
      };
    },
    setTimer: (ms, callback) => {
      const id = setTimeout(callback, ms);
      return () => clearTimeout(id);
    },
    now: () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}
