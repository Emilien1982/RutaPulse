import type { Draft } from '@/core/draft/draft';

import type { LineCollection } from './draftGeometry';
import { endPoints, routeBounds } from './infoGeometry';

const draft: Draft = {
  points: [
    { id: 1, lon: 6.1, lat: 48.66 },
    { id: 2, lon: 6.18, lat: 48.7 },
  ],
  modes: ['path'],
};

describe('routeBounds', () => {
  it('surrounds the points and the whole drawn line', () => {
    const lines: LineCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { mode: 'path' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.1, 48.66],
              [6.2, 48.64],
              [6.18, 48.7],
            ],
          },
        },
      ],
    };
    const [west, south, east, north] = routeBounds(draft, lines) ?? [];
    expect(west).toBeLessThan(6.1);
    expect(east).toBeGreaterThan(6.2);
    expect(south).toBeLessThan(48.64);
    expect(north).toBeGreaterThan(48.7);
  });

  it('is null without any point', () => {
    const empty: LineCollection = { type: 'FeatureCollection', features: [] };
    expect(routeBounds({ points: [], modes: [] }, empty)).toBeNull();
  });
});

describe('endPoints', () => {
  it('gives the start and the arrival', () => {
    expect(endPoints(draft).features.map((f) => f.properties.role)).toEqual([
      'start',
      'end',
    ]);
  });

  it('gives nothing under 2 points', () => {
    expect(
      endPoints({ points: draft.points.slice(0, 1), modes: [] }).features,
    ).toEqual([]);
  });
});

describe('routeBounds on a long route', () => {
  it('handles 200 000 coordinates', () => {
    const coordinates: [number, number][] = [];
    for (let i = 0; i < 200_000; i++)
      coordinates.push([6 + i * 1e-6, 48 + i * 1e-6]);
    const lines: LineCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { mode: 'path' },
          geometry: { type: 'LineString', coordinates },
        },
      ],
    };
    const [west, south, east, north] =
      routeBounds({ points: [], modes: [] }, lines) ?? [];
    expect(west).toBeLessThan(6);
    expect(south).toBeLessThan(48);
    expect(east).toBeGreaterThan(6.19);
    expect(north).toBeGreaterThan(48.19);
  });
});
