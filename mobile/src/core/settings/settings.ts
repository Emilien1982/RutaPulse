// App settings stored in settings.json: see ADR 0013, section 6, and
// ADR 0021, section 8.5.

import type { BrightnessChoice } from '@/core/tracking/brightness';

export type Settings = { wifiOnly: boolean; brightness: BrightnessChoice };

export const defaultSettings: Settings = { wifiOnly: true, brightness: 'auto' };

/**
 * Missing or unreadable file: default values. Each field is read on its own:
 * a missing or wrong one takes its default and does not clear the other.
 */
export function parseSettings(text: string | null): Settings {
  if (text === null) return defaultSettings;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null) {
      const { wifiOnly, brightness } = value as Record<string, unknown>;
      return {
        wifiOnly:
          typeof wifiOnly === 'boolean' ? wifiOnly : defaultSettings.wifiOnly,
        brightness:
          brightness === 'auto' || brightness === 'max'
            ? brightness
            : defaultSettings.brightness,
      };
    }
  } catch {
    // unreadable: fall through to the defaults
  }
  return defaultSettings;
}
