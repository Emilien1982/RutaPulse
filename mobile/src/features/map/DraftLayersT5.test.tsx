import { render } from '@testing-library/react-native';
import { createStore } from '@tanstack/react-store';
import type { ReactNode } from 'react';

import type { Draft } from '@/core/draft/draft';

import { DraftLayers, PreviewLayer } from './DraftLayers';
import { mainGeometry, previewGeometry } from './draftGeometry';
import type { LegState } from './useLegResults';

const mockLayers: Record<string, any> = {};
jest.mock('@maplibre/maplibre-react-native', () => ({
  GeoJSONSource: (props: { children: ReactNode }) => <>{props.children}</>,
  Layer: (props: { id: string }) => {
    mockLayers[props.id] = props;
    return null;
  },
}));

const draft: Draft = {
  points: [
    { id: 1, lon: 6.1, lat: 48.66 },
    { id: 2, lon: 6.14, lat: 48.68 },
    { id: 3, lon: 6.18, lat: 48.7 },
  ],
  modes: ['path', 'hand'],
};
const states: LegState[] = [
  {
    status: 'done',
    result: {
      ok: true,
      shape: [
        [6.101, 48.661],
        [6.139, 48.679],
      ],
      distanceKm: 2,
      durationS: 600,
    },
  },
  { status: 'hand', result: { distanceKm: 3, durationS: 1000 } },
];

describe('dashed hand leg (T5)', () => {
  it('the geometry carries the mode of each leg', () => {
    const { lines, links } = mainGeometry(draft, states, null);
    expect(lines.features.map((f) => f.properties.mode)).toEqual([
      'path',
      'hand',
    ]);
    expect(lines.features[1]?.geometry.coordinates).toEqual([
      [6.14, 48.68],
      [6.18, 48.7],
    ]);
    // The shape of the computed leg ends 100 m or so from its points: one
    // dotted link at each end. None for the hand leg.
    expect(links.features).toHaveLength(2);
    expect(links.features.every((f) => f.properties.mode === 'path')).toBe(
      true,
    );
  });

  it('the preview of the dragged point keeps the dashed style', () => {
    const preview = previewGeometry(draft, states, {}, 2);
    expect(preview.features.map((f) => f.properties.mode)).toEqual([
      'path',
      'hand',
    ]);
  });

  it('layers of the draft and of the preview: dashes 2 / 1 for hand only', async () => {
    const empty = { type: 'FeatureCollection' as const, features: [] };
    await render(
      <>
        <DraftLayers lines={empty} links={empty} />
        <PreviewLayer
          store={createStore({})}
          draft={draft}
          legs={states}
          draggedId={null}
        />
      </>,
    );
    for (const prefix of ['draft', 'draft-preview']) {
      const hand = mockLayers[`${prefix}-hand`];
      expect(hand.paint['line-dasharray']).toEqual([2, 1]);
      expect(hand.filter).toEqual(['==', ['get', 'mode'], 'hand']);
      expect(hand.layout['line-cap']).toBe('butt');
      const plain = mockLayers[`${prefix}-line`];
      expect(plain.filter).toEqual(['!=', ['get', 'mode'], 'hand']);
      expect(plain.paint['line-dasharray']).toBeUndefined();
      // The white casing runs under every leg.
      expect(mockLayers[`${prefix}-casing`].filter).toBeUndefined();
    }
  });
});
