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

/**
 * Default name of a route made from a trail (ADR 0020, section 10): its name,
 * else its number (`ref`), else "Circuit du 9 nov.". Cut to the longest valid
 * name.
 */
export function trailRouteName(
  trail: { name?: string; ref?: string },
  date: Date,
): string {
  const name = normalizeName(trail.name ?? '');
  const ref = normalizeName(trail.ref ?? '');
  const base =
    name !== ''
      ? name
      : ref !== ''
        ? t('trails.refLabel', { ref })
        : t('routes.defaultTrailName', {
            day: date.getDate(),
            month: t(`zones.month.${date.getMonth() + 1}` as TextKey),
          });
  return [...base].slice(0, MAX_NAME_LENGTH).join('').trim();
}

/**
 * `base`, else `base (2)`, `base (3)`... the smallest free number. A long
 * base is shortened so that the whole name keeps 60 characters at most: the
 * suffix stays whole.
 */
export function uniqueDefaultName(
  base: string,
  existing: readonly string[],
): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  for (;;) {
    const suffix = ` (${n})`;
    const room = MAX_NAME_LENGTH - [...suffix].length;
    const name = `${[...base].slice(0, room).join('').trimEnd()}${suffix}`;
    if (!taken.has(name)) return name;
    n++;
  }
}

/**
 * Name of a copy (ADR 0020, section 7 bis): `name (copie)`, else
 * `name (copie 2)`, `name (copie 3)`... the first one free. The name is not
 * parsed: the copy of "X (copie)" is "X (copie) (copie)". A long name is
 * shortened so that the suffix stays whole, at 60 characters at most.
 */
export function copyName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  for (let n = 1; ; n++) {
    const suffix =
      n === 1 ? t('routes.copySuffix') : t('routes.copySuffixN', { n });
    const room = MAX_NAME_LENGTH - [...suffix].length;
    const copy = `${[...name].slice(0, room).join('').trimEnd()}${suffix}`;
    if (!taken.has(copy)) return copy;
  }
}
