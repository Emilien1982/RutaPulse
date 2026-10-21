import { fr, type TextKey } from './fr';

export function t(key: TextKey): string {
  return fr[key];
}
