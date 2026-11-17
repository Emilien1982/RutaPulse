import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { UserPuckLayers } from './UserPuckLayers';

// Testeur T3 (phase 8b). Le point de l'ecran de suivi est "gris, sans fleche"
// quand le GPS est perdu (ADR 0021, question (a)). MapLibre natif refuse un
// filtre invalide et garde l'ancien : preuve sur simulateur (iOS et Android,
// release) que la fleche restait. Ces tests valident chaque filtre avec le
// validateur officiel de la specification de style MapLibre.
const mockLayers: Record<string, { filter?: unknown; type: string }> = {};
jest.mock('@maplibre/maplibre-react-native', () => ({
  Images: () => null,
  GeoJSONSource: (p: { children: ReactNode }) => <>{p.children}</>,
  Layer: (p: { id: string; type: string; filter?: unknown }) => {
    mockLayers[p.id] = p;
    return null;
  },
}));

function errorsOf(id: string): string[] {
  const layer = mockLayers[id];
  const style = {
    version: 8 as const,
    sources: {
      s: {
        type: 'geojson' as const,
        data: { type: 'FeatureCollection' as const, features: [] },
      },
    },
    layers: [{ id, type: layer.type, source: 's', filter: layer.filter }],
  };
  return (validateStyleMin(style as never) as { message: string }[]).map(
    (e) => e.message,
  );
}

describe.each([false, true])('UserPuckLayers, lost = %s', (lost) => {
  it('donne des filtres que MapLibre accepte', async () => {
    await render(<UserPuckLayers feature={null} size="tracking" lost={lost} />);
    for (const id of ['position-halo', 'position-fleche']) {
      expect({
        id,
        errors: errorsOf(id).filter((m) => /filter/.test(m)),
      }).toEqual({ id, errors: [] });
    }
  });
});
