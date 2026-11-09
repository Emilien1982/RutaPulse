// The chevrons that show the direction of a chosen circuit (mockup 12,
// `carte.sens-circuit`). Drawn as points with a bearing, not as text along
// the line: on iPhone the line placement left one chevron on a whole circuit
// (testeur, T4). A point is placed whatever the tiles do.

import type { LonLat } from '@/core/routes/savedRoute';

import type { Trail } from './trails';

/** Spacing in meters, by zoom band: about 60 to 100 points on screen. */
export const CHEVRON_BANDS = [
  { minZoom: 0, maxZoom: 12.5, spacingM: 2500 },
  { minZoom: 12.5, maxZoom: 14, spacingM: 1000 },
  { minZoom: 14, maxZoom: 15.5, spacingM: 400 },
  { minZoom: 15.5, maxZoom: 16.5, spacingM: 150 },
  { minZoom: 16.5, maxZoom: 24, spacingM: 60 },
] as const;

const METERS_PER_DEGREE = 111_195;

export type Chevron = {
  at: LonLat;
  /** Degrees clockwise from the east: the angle of a text ">" on the map. */
  rotate: number;
};

/**
 * Points every `spacingM` meters along the line (the first at half a
 * spacing), each with the direction of its segment. A plane around each
 * segment: enough for a symbol.
 */
export function chevronsAlong(
  line: readonly LonLat[],
  spacingM: number,
): Chevron[] {
  const out: Chevron[] = [];
  let next = spacingM / 2;
  let walked = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [lon1, lat1] = line[i];
    const [lon2, lat2] = line[i + 1];
    const cos = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
    const dx = (lon2 - lon1) * cos * METERS_PER_DEGREE;
    const dy = (lat2 - lat1) * METERS_PER_DEGREE;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    // East is 0, south is 90: the rotation of a text on the map.
    const rotate = (Math.atan2(-dy, dx) * 180) / Math.PI + 0; // no -0
    while (next <= walked + length) {
      const t = (next - walked) / length;
      out.push({
        at: [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t],
        rotate,
      });
      next += spacingM;
    }
    walked += length;
  }
  return out;
}

/**
 * The chevrons of the chosen circuit, one set per zoom band (`band` property).
 * Only a circuit with a known direction (an ordered line) has any: the raw
 * ways are in the OSM sense, which is not the sense of the circuit.
 */
export function chevronsToMapData(trail: Trail | null) {
  const features: {
    type: 'Feature';
    properties: { band: number; rotate: number };
    geometry: { type: 'Point'; coordinates: LonLat };
  }[] = [];
  const line = trail?.line;
  if (line?.kind === 'ordered') {
    CHEVRON_BANDS.forEach((band, index) => {
      for (const c of chevronsAlong(line.ordered, band.spacingM)) {
        features.push({
          type: 'Feature',
          properties: { band: index, rotate: c.rotate },
          geometry: { type: 'Point', coordinates: c.at },
        });
      }
    });
  }
  return { type: 'FeatureCollection' as const, features };
}
