// The recorded answers of the engine for the 4 reference itineraries of the
// trial of phase 8a (see ../fixtures/SOURCE.md). Not used by the app.

import type { PartAnswer } from '../guidance';
import type { FreePart, TrackingSource } from '../trackingLine';
import { buildLine } from '../trackingLine';
import {
  parseMatchedEdges,
  parseTraceRouteResponse,
} from '@/core/routing/guidanceResponse';
import { decodePolyline6 } from '@/core/routing/routeResponse';
import type { LonLat } from '@/core/routes/savedRoute';

import line1 from '../fixtures/line-1.json';
import line2 from '../fixtures/line-2.json';
import line3 from '../fixtures/line-3.json';
import line3d from '../fixtures/line-3d.json';
import reference1 from '../fixtures/reference-1.json';
import reference2 from '../fixtures/reference-2.json';
import reference3 from '../fixtures/reference-3.json';
import reference3d from '../fixtures/reference-3d.json';
import attributes1 from '../fixtures/trace-attributes-1.json';
import attributes2 from '../fixtures/trace-attributes-2.json';
import attributes3 from '../fixtures/trace-attributes-3.json';
import attributes3d from '../fixtures/trace-attributes-3d.json';
import route1 from '../fixtures/trace-route-1.json';
import route2 from '../fixtures/trace-route-2.json';
import route3 from '../fixtures/trace-route-3.json';
import route3d from '../fixtures/trace-route-3d.json';

export type RecordedName = '1' | '2' | '3' | '3d';

/** What the reference list says for one itinerary (Python, trial folder). */
export type Reference = {
  free: FreePart[];
  directions: { atM: number; text: string }[];
};

const RAW = {
  '1': { line: line1, route: route1, attributes: attributes1, ref: reference1 },
  '2': { line: line2, route: route2, attributes: attributes2, ref: reference2 },
  '3': { line: line3, route: route3, attributes: attributes3, ref: reference3 },
  '3d': {
    line: line3d,
    route: route3d,
    attributes: attributes3d,
    ref: reference3d,
  },
};

export const RECORDED_NAMES: RecordedName[] = ['1', '2', '3', '3d'];

/** The title of each itinerary, for the files of directions. */
export const RECORDED_TITLES: Record<RecordedName, string> = {
  '1': 'Itinéraire créé (34 km, forêt de Haye)',
  '2': 'Circuit balisé de la forêt de Haye (21 km)',
  '3': 'GPX simulé, avec bruit GPS (35 km, Petite Suisse lorraine)',
  '3d': 'Même circuit que le GPX simulé, sans bruit (35 km)',
};

export function recorded(name: RecordedName): {
  source: TrackingSource;
  answer: PartAnswer;
  reference: Reference;
} {
  const raw = RAW[name];
  const line = buildLine(decodePolyline6(raw.line.polyline6) as LonLat[]);
  return {
    source: { line, free: [] },
    answer: {
      trace: parseTraceRouteResponse(JSON.stringify(raw.route)),
      edges: parseMatchedEdges(JSON.stringify(raw.attributes)),
    },
    reference: raw.ref as Reference,
  };
}
