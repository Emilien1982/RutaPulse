// Reads and writes settings.json in the document folder (ADR 0013, section 6).

import { File, Paths } from 'expo-file-system';

import { parseSettings, type Settings } from '@/core/settings/settings';

const listeners = new Set<() => void>();

function settingsFile(): File {
  return new File(Paths.document, 'settings.json');
}

export async function readSettings(): Promise<Settings> {
  try {
    const file = settingsFile();
    return parseSettings(file.exists ? await file.text() : null);
  } catch {
    return parseSettings(null);
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  const file = settingsFile();
  file.create({ overwrite: true });
  file.write(JSON.stringify(settings));
  listeners.forEach((listener) => listener());
}

/** Called after each write. Returns a function that stops the listening. */
export function onSettingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
