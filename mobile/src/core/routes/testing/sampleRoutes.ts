// Routes used by the tests of this folder and of shared-data/routes/.

import type { CreatedRoute, GpxRoute } from '../savedRoute';

const ZONE = { id: 'nancy', version: 5, name: 'Nancy' };

export function sampleCreated(
  patch: Partial<Omit<CreatedRoute, 'id' | 'readable'>> = {},
): Omit<CreatedRoute, 'id' | 'readable'> {
  return {
    name: 'Boucle du Bois',
    origin: 'created',
    createdAt: 1_000,
    savedAt: 1_000,
    zone: ZONE,
    draft: {
      points: [
        { id: 1, lon: 6.18, lat: 48.69 },
        { id: 2, lon: 6.19, lat: 48.7 },
        { id: 3, lon: 6.2, lat: 48.71 },
      ],
      modes: ['path', 'hand'],
      linked: [3],
    },
    legs: [
      {
        mode: 'path',
        zoneVersion: 5,
        distanceKm: 1.234,
        durationS: 300,
        shape: [
          [6.18, 48.69],
          [6.185, 48.695],
          [6.19, 48.7],
        ],
      },
      { mode: 'hand' },
    ],
    preview: '_p~iF~ps|U',
    distanceKm: 2.5,
    durationS: 700,
    ascentM: null,
    descentM: null,
    figuresAt: null,
    ...patch,
  };
}

export function sampleGpx(
  patch: Partial<Omit<GpxRoute, 'id' | 'readable'>> = {},
): Omit<GpxRoute, 'id' | 'readable'> {
  return {
    name: 'Sortie importée',
    origin: 'gpx',
    createdAt: 2_000,
    savedAt: 2_000,
    zone: null,
    track: [
      [6.18, 48.69],
      [6.181, 48.691],
      [6.182, 48.692],
    ],
    elevations: [212, null, 215.5],
    preview: '_p~iF~ps|U',
    distanceKm: 0.3,
    durationS: 100,
    ascentM: 4,
    descentM: 1,
    figuresAt: 3_000,
    ...patch,
  };
}
