// Helpers of the tests: a `trails.geojson` text and trails built from it.

import nancy from '@/core/routes/fixtures/nancyCircuits.json';

import { parseTrails, type Trail } from './trails';

type Feature = {
  osm_id: number;
  name?: string | null;
  ref?: string;
  length_m?: number;
  /** Absent: an old zone. Null: refused. */
  ordered?: [number, number][] | null;
  loop?: boolean | null;
  ordered_m?: number | null;
  removed_m?: number | null;
  refusal?: string | null;
  ways?: [number, number][][];
};

export function trailsFile(features: Feature[]): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: features.map(({ ways, ...properties }) => ({
      type: 'Feature',
      properties,
      geometry: {
        type: 'MultiLineString',
        coordinates: ways ?? (properties.ordered ? [properties.ordered] : []),
      },
    })),
  });
}

/** The two circuits of Nancy (fixture of the phase 7), with an ordered line. */
export function nancyTrails(): Trail[] {
  return parseTrails(
    trailsFile(
      nancy.circuits.map((c) => ({
        osm_id: c.osm_id,
        name: c.name,
        length_m: c.ordered_m + 1000,
        ordered: c.ordered as [number, number][],
        loop: c.loop,
        ordered_m: c.ordered_m,
        removed_m: 0,
        refusal: null,
      })),
    ),
  );
}
