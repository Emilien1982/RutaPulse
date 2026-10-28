// What the map draws for a draft: three GeoJSON collections, one per source
// (ADR 0016, section 4). Pure functions, no map.

import type { Draft, LegMode } from '@/core/draft/draft';
import { listLegs, type Leg } from '@/core/draft/legs';
import { linkSegments } from '@/core/routing/routeLink';

import type { DragPreview } from './useDragPreview';
import type { LegState } from './useLegResults';

type Coordinates = [number, number][];

export type LineCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { mode: LegMode };
    geometry: { type: 'LineString'; coordinates: Coordinates };
  }[];
};

function line(mode: LegMode, coordinates: Coordinates) {
  return {
    type: 'Feature' as const,
    properties: { mode },
    geometry: { type: 'LineString' as const, coordinates },
  };
}

function collection(features: LineCollection['features']): LineCollection {
  return { type: 'FeatureCollection', features };
}

// The legs that follow the dragged point: both legs next to it.
function isDragged(leg: Leg, draggedId: number | null) {
  return (
    draggedId !== null && (leg.from.id === draggedId || leg.to.id === draggedId)
  );
}

/**
 * - `lines`: every leg that has a shape. "By hand" legs are straight lines
 *   (drawn as plain lines for now: dashes come with the hand-drawn task).
 * - `links`: the dotted links at both ends of each computed leg.
 * The two legs next to the dragged point are left out: see `previewGeometry`.
 */
export function mainGeometry(
  draft: Draft,
  states: LegState[],
  draggedId: number | null,
): { lines: LineCollection; links: LineCollection } {
  const lines: LineCollection['features'] = [];
  const links: LineCollection['features'] = [];
  for (const leg of listLegs(draft)) {
    if (isDragged(leg, draggedId)) continue;
    const state = states[leg.index];
    if (state?.status === 'hand') {
      lines.push(line('hand', straight(leg)));
    } else if (state?.status === 'done' && state.result.shape.length > 1) {
      const { shape } = state.result;
      lines.push(line('path', shape));
      for (const segment of linkSegments(leg.from, leg.to, shape)) {
        links.push(line('path', segment));
      }
    }
  }
  return { lines: collection(lines), links: collection(links) };
}

function straight(leg: Leg): Coordinates {
  return [
    [leg.from.lon, leg.from.lat],
    [leg.to.lon, leg.to.lat],
  ];
}

/**
 * The two legs next to the dragged point, in the source that changes during
 * the gesture: their last preview, or their old shape until the first one
 * arrives.
 */
export function previewGeometry(
  draft: Draft,
  states: LegState[],
  preview: DragPreview,
  draggedId: number | null,
): LineCollection {
  const features: LineCollection['features'] = [];
  if (draggedId === null) return collection(features);
  for (const leg of listLegs(draft)) {
    if (!isDragged(leg, draggedId)) continue;
    const state = states[leg.index];
    const shape =
      preview[leg.index]?.shape ??
      (leg.mode === 'hand'
        ? straight(leg)
        : state?.status === 'done'
          ? state.result.shape
          : undefined);
    if (shape && shape.length > 1) features.push(line(leg.mode, shape));
  }
  return collection(features);
}

/** Both at once. */
export function buildDraftGeometry(
  draft: Draft,
  states: LegState[],
  preview: DragPreview,
  draggedId: number | null,
) {
  return {
    ...mainGeometry(draft, states, draggedId),
    previews: previewGeometry(draft, states, preview, draggedId),
  };
}
