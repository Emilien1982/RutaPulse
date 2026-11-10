// Numbered or discrete markers (mockup 12, "Règles d'affichage"). Pure logic.

/** 28 of the marker plus 16 of gap: below this, numbered markers overlap. */
export const NUMBERED_MIN_GAP_PX = 44;

/** Side of the world in screen points at zoom 0 (MapLibre tiles of 512). */
const WORLD_PX = 512;

function toPixels(lon: number, lat: number, zoom: number): [number, number] {
  const scale = WORLD_PX * 2 ** zoom;
  const sin = Math.sin((Math.min(85, Math.max(-85, lat)) * Math.PI) / 180);
  return [
    ((lon + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

/** Median distance on screen (points) between neighbouring points. */
export function medianGapPx(
  points: readonly { lon: number; lat: number }[],
  zoom: number,
): number {
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = toPixels(points[i - 1].lon, points[i - 1].lat, zoom);
    const [x2, y2] = toPixels(points[i].lon, points[i].lat, zoom);
    gaps.push(Math.hypot(x2 - x1, y2 - y1));
  }
  if (gaps.length === 0) return Infinity;
  gaps.sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

/** All or nothing: every middle point is discrete when they are too close. */
export function discreteMarkers(
  points: readonly { lon: number; lat: number }[],
  zoom: number,
): boolean {
  return medianGapPx(points, zoom) < NUMBERED_MIN_GAP_PX;
}
