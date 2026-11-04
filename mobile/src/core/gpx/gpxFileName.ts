// File name of an exported route (ADR 0019, section 8). Pure logic.

/**
 * `/ \ : * ? " < > |` and control characters become "-"; accents stay.
 * Dots and spaces at the end are dropped, so the name never ends with "..gpx".
 */
export function gpxFileName(name: string): string {
  const base = name
    .replace(/[/\\:*?"<>|\p{Cc}]/gu, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim();
  return `${base === '' ? 'itineraire' : base}.gpx`;
}
