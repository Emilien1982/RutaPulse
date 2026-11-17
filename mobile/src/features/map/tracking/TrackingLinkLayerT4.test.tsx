import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { createStore } from '@tanstack/react-store';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { buildLine } from '@/core/tracking/trackingLine';
import { createTracking } from '@/core/tracking/trackingState';

import { TrackingMap } from './TrackingMap';

// Phase 8b, T4: the style of the link layer goes through the official
// validator of MapLibre (the mocks of Jest do not check it).
const mockLayers: Record<string, Record<string, unknown>> = {};
const mockSources: string[] = [];
jest.mock('@maplibre/maplibre-react-native', () => ({
  Camera: () => null,
  Map: (p: { children: ReactNode }) => <>{p.children}</>,
  Images: () => null,
  GeoJSONSource: (p: { id: string; children: ReactNode }) => {
    mockSources.push(p.id);
    return <>{p.children}</>;
  },
  Layer: (p: { id: string }) => {
    mockLayers[p.id] = p as never;
    return null;
  },
}));

describe('the link layer of the tracking', () => {
  it('is declared before the route and accepted by the style validator', async () => {
    const line = buildLine([
      [6, 48.7],
      [6.01, 48.7],
    ]);
    const state = createTracking(
      {
        line,
        free: [],
        links: [
          [
            [6, 48.7001],
            [6, 48.7],
          ],
        ],
      },
      0,
    );
    const store = createStore(state);
    await render(
      <TrackingMap
        zone={null}
        store={store}
        source={{
          line,
          free: [],
          links: [
            [
              [6, 48.7001],
              [6, 48.7],
            ],
          ],
        }}
        bottom={null}
      />,
    );
    expect(mockSources.indexOf('suivi-liaison')).toBe(0);
    const layer = mockLayers['suivi-liaison-ligne'];
    expect(layer).toBeDefined();
    expect(layer.beforeId).toBeUndefined();
    const style = {
      version: 8 as const,
      sources: {
        s: {
          type: 'geojson' as const,
          data: { type: 'FeatureCollection' as const, features: [] },
        },
      },
      layers: [
        {
          id: 'x',
          type: 'line',
          source: 's',
          layout: layer.layout,
          paint: layer.paint,
        },
      ],
    };
    const errors = validateStyleMin(style as never) as { message: string }[];
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});
