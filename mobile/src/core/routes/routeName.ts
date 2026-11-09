// Name of a saved route (ADR 0019, sections 11 and 13, point 6).

import { t } from '@/core/i18n/t';
import type { TextKey } from '@/core/i18n/fr';

export const MAX_NAME_LENGTH = 60;

/** Trims, turns runs of spaces and line breaks into one space, drops controls. */
export function normalizeName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export type NameCheck =
  { ok: true; name: string } | { ok: false; reason: 'empty' | 'tooLong' };

/** Valid: not empty, 60 displayed characters (code points) at most. */
export function checkName(raw: string): NameCheck {
  const name = normalizeName(raw);
  if (name === '') return { ok: false, reason: 'empty' };
  if ([...name].length > MAX_NAME_LENGTH) {
    return { ok: false, reason: 'tooLong' };
  }
  return { ok: true, name };
}

export class RouteNameError extends Error {
  constructor(public reason: 'empty' | 'tooLong') {
    super(`Invalid route name: ${reason}`);
  }
}

/** Ends an announcement with one full stop, even if the name had one. */
export function announcement(text: string): string {
  return text.replace(/\.\.$/, '.');
}

/** "Itinéraire du 3 nov.", from the local date. */
export function defaultRouteName(date: Date): string {
  return t('routes.defaultName', {
    day: date.getDate(),
    month: t(`zones.month.${date.getMonth() + 1}` as TextKey),
  });
}

/** `base`, else `base (2)`, `base (3)`... the smallest free number. */
export function uniqueDefaultName(
  base: string,
  existing: readonly string[],
): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
