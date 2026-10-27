import { fr, type TextKey } from './fr';

// `{name}` marks in the text are replaced by the matching value of `params`.
export function t(key: TextKey, params?: Record<string, string | number>) {
  const text: string = fr[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (mark, name: string) =>
    name in params ? String(params[name]) : mark,
  );
}
