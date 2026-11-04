// The camera that shows a box in the visible part of the map. Pure functions.

/** Highest zoom when the box is tiny (a route of a few meters). */
export const FIT_MAX_ZOOM = 17;
/** Free space kept around the route, in points. */
export const FIT_MARGIN = 48;

const TILE = 256;

function mercatorX(lon: number): number {
  return (lon + 180) / 360;
}

function mercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

export type FitCovered = { top: number; bottom: number };

/**
 * Center and zoom that fit [west, south, east, north] in the screen, with a
 * margin of 48 around it, and the top bar and the bottom panel (`covered`)
 * left free. The zoom is 17 at most. `padding` is to be given to the camera
 * too: it moves the center into the visible part.
 */
export function fitView(
  bounds: readonly [number, number, number, number],
  screen: { width: number; height: number },
  covered: FitCovered,
  maxZoom: number = FIT_MAX_ZOOM,
) {
  const [west, south, east, north] = bounds;
  const padding = {
    top: covered.top + FIT_MARGIN,
    bottom: covered.bottom + FIT_MARGIN,
    left: FIT_MARGIN,
    right: FIT_MARGIN,
  };
  const visibleW = Math.max(screen.width - padding.left - padding.right, 1);
  const visibleH = Math.max(screen.height - padding.top - padding.bottom, 1);
  const spanX = mercatorX(east) - mercatorX(west);
  const spanY = mercatorY(south) - mercatorY(north);
  const zoomX = spanX > 0 ? Math.log2(visibleW / (TILE * spanX)) : maxZoom;
  const zoomY = spanY > 0 ? Math.log2(visibleH / (TILE * spanY)) : maxZoom;
  return {
    center: [(west + east) / 2, (south + north) / 2] as [number, number],
    zoom: Math.min(zoomX, zoomY, maxZoom),
    padding,
  };
}
