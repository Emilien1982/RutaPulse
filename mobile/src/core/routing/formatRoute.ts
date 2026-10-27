// Distance and duration as shown on the route sheet (mockup 10).
// French decimal comma, whatever the language of the phone.

import { t } from '../i18n/t';

/** Kilometers with one decimal ("25,1 km"); under 1 km, meters ("850 m"). */
export function formatDistance(km: number): string {
  // A rounding that reaches 1 km is written in kilometers.
  if (Math.round(km * 1000) < 1000) {
    return t('format.m', { n: String(Math.round(km * 1000)) });
  }
  return t('format.km', { n: km.toFixed(1).replace('.', ',') });
}

/** Rounded to the minute: "21 min", "1 h 35" (minutes on two digits). */
export function formatDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds / 60));
  if (total < 60) return t('format.min', { n: String(total) });
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, '0');
  return t('format.hoursMinutes', { h: String(h), m });
}
