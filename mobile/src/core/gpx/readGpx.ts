// Reads a GPX 1.0 or 1.1 text (ADR 0019, section 7). Pure logic: no file, no
// network. The messages shown to the user are chosen by the caller from the
// refusal code.

import { readAttributes, scanXml, XmlError } from './xmlScan';

/** Biggest text accepted, in characters (the import also checks bytes). */
export const MAX_GPX_CHARS = 20_000_000;
export const MAX_NAME_CHARS = 60;
/** Plausible altitudes (m); anything else is read as unknown. */
export const MIN_ELEVATION_M = -1000;
export const MAX_ELEVATION_M = 10000;

export type GpxRefusal = 'tooBig' | 'empty' | 'unreadable' | 'noTrack';

export type GpxResult =
  | {
      ok: true;
      /** Name found in the file, normalized, cut to 60 characters. May be ''. */
      name: string;
      /** [lon, lat] points, 6 decimals. At least 2. */
      track: [number, number][];
      /** One altitude (m) per point, null when unknown. */
      elevations: (number | null)[];
    }
  | { ok: false; reason: GpxRefusal };

type Points = { track: [number, number][]; elevations: (number | null)[] };

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const TEXT_ELEMENTS: ReadonlySet<string> = new Set(['name', 'ele']);

function decimal(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return DECIMAL.test(trimmed) ? Number(trimmed) : null;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6 + 0; // + 0 turns -0 into 0
}

function cleanName(raw: string): string {
  const name = raw
    .replace(/\s+/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .trim();
  return name.length > MAX_NAME_CHARS
    ? Array.from(name).slice(0, MAX_NAME_CHARS).join('').trim()
    : name;
}

function emptyPoints(): Points {
  return { track: [], elevations: [] };
}

function add(points: Points, lon: number, lat: number, ele: number | null) {
  const last = points.track[points.track.length - 1];
  if (last && last[0] === lon && last[1] === lat) return;
  points.track.push([lon, lat]);
  points.elevations.push(ele);
}

export function readGpx(text: string): GpxResult {
  if (text.length > MAX_GPX_CHARS) return { ok: false, reason: 'tooBig' };
  if (text.trim() === '') return { ok: false, reason: 'empty' };

  const trace = emptyPoints();
  const route = emptyPoints();
  let metadataName = '';
  let rootName = '';
  let traceName = '';
  let routeName = '';
  let current: { lon: number; lat: number; ele: number | null } | null = null;

  try {
    scanXml(
      text,
      {
        open(path, attributes) {
          const last = path[path.length - 1];
          const parent = path[path.length - 2];
          const isPoint =
            (last === 'trkpt' && path.length === 4 && parent === 'trkseg') ||
            (last === 'rtept' && path.length === 3 && parent === 'rte');
          if (!isPoint) return;
          const attrs = readAttributes(attributes);
          const lat = decimal(attrs.get('lat'));
          const lon = decimal(attrs.get('lon'));
          const valid =
            lat !== null &&
            lon !== null &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180;
          current = valid
            ? { lon: round6(lon), lat: round6(lat), ele: null }
            : null;
        },
        close(path, content) {
          const n = path.length;
          const last = path[n - 1];
          if (last === 'trkpt' && n === 4 && path[2] === 'trkseg') {
            if (current) add(trace, current.lon, current.lat, current.ele);
            current = null;
          } else if (last === 'rtept' && n === 3 && path[1] === 'rte') {
            if (current) add(route, current.lon, current.lat, current.ele);
            current = null;
          } else if (last === 'ele') {
            const inTrkpt =
              n === 5 && path[3] === 'trkpt' && path[2] === 'trkseg';
            const inRtept = n === 4 && path[2] === 'rtept' && path[1] === 'rte';
            if (current && (inTrkpt || inRtept)) {
              const ele = decimal(content);
              current.ele =
                ele !== null && ele >= MIN_ELEVATION_M && ele <= MAX_ELEVATION_M
                  ? ele
                  : null;
            }
          } else if (last === 'name') {
            const name = cleanName(content);
            if (name === '') return;
            if (n === 3 && path[1] === 'metadata') metadataName ||= name;
            else if (n === 2) rootName ||= name;
            else if (n === 3 && path[1] === 'trk') traceName ||= name;
            else if (n === 3 && path[1] === 'rte') routeName ||= name;
          }
        },
      },
      TEXT_ELEMENTS,
    );
  } catch (error) {
    if (error instanceof XmlError) return { ok: false, reason: 'unreadable' };
    throw error;
  }

  const points = trace.track.length >= 2 ? trace : route;
  if (points.track.length < 2) return { ok: false, reason: 'noTrack' };
  return {
    ok: true,
    name: metadataName || rootName || traceName || routeName,
    track: points.track,
    elevations: points.elevations,
  };
}
