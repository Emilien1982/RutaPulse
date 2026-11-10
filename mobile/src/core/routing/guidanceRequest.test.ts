import {
  buildMatchedEdgesRequest,
  buildTraceRouteRequest,
} from './guidanceRequest';
import { decodePolyline6 } from './routeResponse';

const shape: [number, number][] = [
  [6.1, 48.5],
  [6.1005, 48.5004],
  [6.101, 48.5],
];

describe('buildTraceRouteRequest', () => {
  it('asks map_snap, the bicycle costing and the French directions', () => {
    const body = JSON.parse(buildTraceRouteRequest(shape));
    expect(body.shape_match).toBe('map_snap');
    expect(body.costing).toBe('bicycle');
    expect(body.costing_options).toEqual({
      bicycle: { bicycle_type: 'mountain', use_roads: 0 },
    });
    expect(body.directions_options).toEqual({
      language: 'fr-FR',
      units: 'kilometers',
    });
    expect(decodePolyline6(body.encoded_polyline)).toEqual(shape);
  });
});

describe('buildMatchedEdgesRequest', () => {
  it('asks map_snap and the attributes the directions need', () => {
    const body = JSON.parse(buildMatchedEdgesRequest(shape));
    expect(body.shape_match).toBe('map_snap');
    expect(body.costing).toBe('bicycle');
    expect(body.filters).toEqual({
      attributes: [
        'edge.use',
        'edge.density',
        'edge.begin_shape_index',
        'shape',
      ],
      action: 'include',
    });
    expect(decodePolyline6(body.encoded_polyline)).toEqual(shape);
  });
});
