// Writes a GPX 1.1 text (ADR 0019, section 8). The output only depends on
// the name and the points, so tests compare an exact text.

export type WriteGpxInput = {
  name: string;
  /** [lon, lat] points. */
  track: readonly (readonly number[])[];
  /** One altitude (m) per point, null or missing when unknown. */
  elevations?: readonly (number | null | undefined)[];
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Escapes a text and drops the characters XML 1.0 forbids. */
export function escapeXml(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        result += text[i] + text[i + 1];
        i++;
      } // else a lone half: dropped
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    if (code === 0xfffe || code === 0xffff) continue;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
      continue;
    result += ESCAPES[text[i]] ?? text[i];
  }
  return result;
}

function coordinate(value: number, isLon: boolean): string {
  let text = value.toFixed(6);
  if (isLon && text === '180.000000') text = '-180.000000'; // schema: lon < 180
  return text === '-0.000000' ? '0.000000' : text;
}

export function writeGpx({ name, track, elevations }: WriteGpxInput): string {
  const title = escapeXml(name);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="RutaPulse" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${title}</name>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${title}</name>`,
    '    <trkseg>',
  ];
  for (let i = 0; i < track.length; i++) {
    const [lon, lat] = track[i];
    const open = `      <trkpt lat="${coordinate(lat, false)}" lon="${coordinate(lon, true)}"`;
    const ele = elevations?.[i];
    if (ele === null || ele === undefined || !Number.isFinite(ele)) {
      lines.push(`${open}/>`);
    } else {
      lines.push(`${open}><ele>${Number(ele.toFixed(1)) + 0}</ele></trkpt>`);
    }
  }
  lines.push('    </trkseg>', '  </trk>', '</gpx>', '');
  return lines.join('\n');
}
