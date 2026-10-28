import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useSelector, type Store } from '@tanstack/react-store';
import { memo, useMemo } from 'react';

import { mapColors } from '@/ui/theme';

import type { Draft } from '@/core/draft/draft';

import { previewGeometry, type LineCollection } from './draftGeometry';
import type { DragPreview } from './useDragPreview';
import type { LegState } from './useLegResults';

// Widths of the mockup (zoom 15): line 7, casing 11. About x 0.6 at zoom 12
// and x 1.3 at zoom 17 (design/tokens.md).
function widthByZoom(at15: number) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    12,
    at15 * 0.6,
    15,
    at15,
    17,
    at15 * 1.3,
  ] as never;
}

const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
// Dashes keep square ends, like the mockup 11 (stroke-linecap butt).
const BUTT = { 'line-cap': 'butt', 'line-join': 'round' } as const;

const IS_HAND = ['==', ['get', 'mode'], 'hand'] as never;
const IS_PATH = ['!=', ['get', 'mode'], 'hand'] as never;

// The three layers of a collection of legs: the white casing under all of
// them, the plain line of the 'path' legs, and the dashed line of the 'hand'
// legs (`trace.a-la-main`: dashes 2 x the width, gaps 1 x the width, so 14 / 7
// for the line of 7 of the mockup 11).
function LegLines({ prefix }: { prefix: string }) {
  return (
    <>
      <Layer
        id={`${prefix}-casing`}
        type="line"
        layout={ROUND}
        paint={{
          'line-color': mapColors.routeCasing,
          'line-width': widthByZoom(11),
        }}
      />
      <Layer
        id={`${prefix}-line`}
        type="line"
        filter={IS_PATH}
        layout={ROUND}
        paint={{
          'line-color': mapColors.route,
          'line-width': widthByZoom(7),
        }}
      />
      <Layer
        id={`${prefix}-hand`}
        type="line"
        filter={IS_HAND}
        layout={BUTT}
        paint={{
          'line-color': mapColors.route,
          'line-width': widthByZoom(7),
          'line-dasharray': [2, 1],
        }}
      />
    </>
  );
}

// The lines of the draft: one source for all the legs, one for the dotted
// links, one for the preview of the dragged point. Only the last one changes
// during a gesture (ADR 0016, section 4). From bottom to top: link, casing,
// line, preview. The sources are always mounted (empty when there is nothing
// to draw): "draft-casing" must exist from the opening, or iOS forgets the
// link layer that waits for it with `beforeId`.
export const DraftLayers = memo(function DraftLayers({
  lines,
  links,
}: {
  lines: LineCollection;
  links: LineCollection;
}) {
  return (
    <>
      <GeoJSONSource id="draft-link" data={links}>
        <Layer
          id="draft-link-line"
          type="line"
          beforeId="draft-casing"
          layout={ROUND}
          paint={{
            'line-color': mapColors.routeLink,
            'line-width': widthByZoom(3),
            'line-dasharray': [0.1, 2.5],
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="draft-legs" data={lines}>
        <LegLines prefix="draft" />
      </GeoJSONSource>
    </>
  );
});

// The preview of the dragged point, in its own component: it reads the
// preview store itself, so an answer redraws this layer and nothing else.
export const PreviewLayer = memo(function PreviewLayer({
  store,
  draft,
  legs,
  draggedId,
}: {
  store: Store<DragPreview>;
  draft: Draft;
  legs: LegState[];
  draggedId: number | null;
}) {
  const preview = useSelector(store, (s) => s);
  const data = useMemo(
    () => previewGeometry(draft, legs, preview, draggedId),
    [draft, legs, preview, draggedId],
  );
  return (
    <GeoJSONSource id="draft-preview" data={data}>
      <LegLines prefix="draft-preview" />
    </GeoJSONSource>
  );
});
