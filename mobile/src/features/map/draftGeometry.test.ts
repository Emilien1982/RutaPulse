import type { Draft } from '@/core/draft/draft';

import { buildDraftGeometry } from './draftGeometry';
import type { LegState } from './useLegResults';

const draft: Draft = {
  points: [
    { id: 1, lon: 6.1, lat: 48.6 },
    { id: 2, lon: 6.2, lat: 48.7 },
    { id: 3, lon: 6.3, lat: 48.6 },
  ],
  modes: ['path', 'path'],
};
const done = (shape: [number, number][]): LegState => ({
  status: 'done',
  result: { ok: true, shape, distanceKm: 1, durationS: 60 },
});
// Shapes that end 1 km away from the points: the links are drawn.
const shapeA: [number, number][] = [
  [6.11, 48.61],
  [6.19, 48.69],
];
const shapeB: [number, number][] = [
  [6.21, 48.71],
  [6.29, 48.61],
];

describe('buildDraftGeometry', () => {
  it('draws the computed legs and the links at both ends', () => {
    const g = buildDraftGeometry(draft, [done(shapeA), done(shapeB)], {}, null);
    expect(g.lines.features.map((f) => f.geometry.coordinates)).toEqual([
      shapeA,
      shapeB,
    ]);
    expect(g.links.features).toHaveLength(4);
    expect(g.previews.features).toHaveLength(0);
  });

  it('draws nothing for pending legs and failed legs', () => {
    const g = buildDraftGeometry(
      draft,
      [{ status: 'pending' }, { status: 'error', error: 'farFromPath' }],
      {},
      null,
    );
    expect(g.lines.features).toHaveLength(0);
    expect(g.links.features).toHaveLength(0);
  });

  it('draws a hand leg as a straight line with its mode', () => {
    const hand: Draft = { ...draft, modes: ['hand', 'path'] };
    const g = buildDraftGeometry(
      hand,
      [
        {
          status: 'hand',
          result: { distanceKm: 1, durationS: 1 },
        },
        done(shapeB),
      ],
      {},
      null,
    );
    expect(g.lines.features[0]).toMatchObject({
      properties: { mode: 'hand' },
      geometry: {
        coordinates: [
          [6.1, 48.6],
          [6.2, 48.7],
        ],
      },
    });
  });

  it('moves the legs next to the dragged point to the preview source', () => {
    const states = [done(shapeA), done(shapeB)];
    const newShape: [number, number][] = [
      [6.15, 48.65],
      [6.25, 48.75],
    ];
    const g = buildDraftGeometry(
      draft,
      states,
      { 0: { ok: true, shape: newShape, distanceKm: 1, durationS: 1 } },
      2,
    );
    // Both legs touch point 2: none stays in the main source.
    expect(g.lines.features).toHaveLength(0);
    expect(g.links.features).toHaveLength(0);
    // Leg 0 shows its preview, leg 1 its old shape.
    expect(g.previews.features.map((f) => f.geometry.coordinates)).toEqual([
      newShape,
      shapeB,
    ]);
  });

  it('keeps a leg far from the dragged point in the main source', () => {
    const g = buildDraftGeometry(draft, [done(shapeA), done(shapeB)], {}, 1);
    expect(g.lines.features).toHaveLength(1);
    expect(g.previews.features).toHaveLength(1);
  });

  it('puts a "by hand" leg next to the dragged point in the preview too', () => {
    const hand: Draft = { ...draft, modes: ['hand', 'path'] };
    const g = buildDraftGeometry(
      hand,
      [
        { status: 'hand', result: { distanceKm: 1, durationS: 1 } },
        done(shapeB),
      ],
      {},
      2,
    );
    expect(g.lines.features).toHaveLength(0);
    expect(g.previews.features.map((f) => f.geometry.coordinates)).toEqual([
      [
        [6.1, 48.6],
        [6.2, 48.7],
      ],
      shapeB,
    ]);
  });
});
