// Operations that core/ needs from the phone. They are passed as parameters,
// so that the logic runs without a phone (ADR 0013, section 9).
// Every path is relative to the document folder.

import type { NetworkInfo } from './networkRule';

export type DownloadHandle = {
  /** Settles when the file is written, or rejects (also after `cancel`). */
  done: Promise<void>;
  cancel: () => void;
};

export type ZoneOps = {
  /** `onProgress` receives the number of bytes written so far. */
  startDownload: (
    url: string,
    path: string,
    onProgress: (bytesWritten: number) => void,
  ) => DownloadHandle;
  /** Size in bytes, or null if there is no such file. */
  fileSize: (path: string) => Promise<number | null>;
  sha256: (path: string) => Promise<string>;
  /** Null if there is no such file. */
  readText: (path: string) => Promise<string | null>;
  writeText: (path: string, text: string) => Promise<void>;
  /** Creates the folder and its parents; no error if it exists. */
  makeDir: (path: string) => Promise<void>;
  /** Names inside a folder; empty list if there is no such folder. */
  listDir: (path: string) => Promise<string[]>;
  /** Deletes a file or a folder with its content; no error if absent. */
  remove: (path: string) => Promise<void>;
  availableSpace: () => Promise<number>;
  getNetwork: () => Promise<NetworkInfo>;
  getWifiOnly: () => Promise<boolean>;
  /** Called when the network or the Wi-Fi only setting changes. */
  onConditionsChange: (listener: () => void) => () => void;
  /** Returns a function that cancels the timer. */
  setTimer: (ms: number, callback: () => void) => () => void;
  /** Current time, as in `osmDate`: 2026-10-24T10:12:31Z. */
  now: () => string;
};
