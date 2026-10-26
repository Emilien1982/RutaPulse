// App settings stored in settings.json: see ADR 0013, section 6.

export type Settings = { wifiOnly: boolean };

export const defaultSettings: Settings = { wifiOnly: true };

/** Missing or unreadable file: default values. */
export function parseSettings(text: string | null): Settings {
  if (text === null) return defaultSettings;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null) {
      const wifiOnly = (value as Record<string, unknown>).wifiOnly;
      if (typeof wifiOnly === 'boolean') return { wifiOnly };
    }
  } catch {
    // unreadable: fall through to the defaults
  }
  return defaultSettings;
}
