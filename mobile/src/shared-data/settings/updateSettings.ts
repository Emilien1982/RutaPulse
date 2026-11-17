// Changes some settings and keeps the others (ADR 0021, section 8.5).

import type { Settings } from '@/core/settings/settings';

import { readSettings, writeSettings } from './settingsFile';

// The writes go one after the other: two quick touches must not lose one.
let last: Promise<unknown> = Promise.resolve();

/** Reads the file, merges `patch`, writes it. Returns what was written. */
export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const run = async () => {
    const next = { ...(await readSettings()), ...patch };
    await writeSettings(next);
    return next;
  };
  const result = last.then(run, run);
  last = result.catch(() => undefined);
  return result;
}
