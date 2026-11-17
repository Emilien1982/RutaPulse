import { distanceMeters } from '@/core/routing/routeLink';

import type { Bbox } from './catalogue';
import { nearCenter, nearZoom, NEAR_ZONE_M, openingPlan } from './opening';

// The zone of Nancy.
const bbox: Bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };
const MAP = { width: 390, height: 752 };
const KEEP = { side: 48, top: 140, bottom: 32 + 80 };

// Degrees of longitude for a distance east-west at a latitude.
const eastOf = (meters: number, lat: number) =>
  meters / (111_195 * Math.cos((lat * Math.PI) / 180));

describe('openingPlan', () => {
  it('is inside for a point in the zone, edges included', () => {
    expect(openingPlan(bbox, 6.18, 48.69)).toEqual({ kind: 'inside' });
    expect(openingPlan(bbox, 6.52, 48.7)).toEqual({ kind: 'inside' });
  });

  it('is near, 3 km from each side, with the edge point', () => {
    const deg = 3000 / 111_195;
    const lonDeg = eastOf(3000, 48.7);
    expect(openingPlan(bbox, 6.52 + lonDeg, 48.7)).toEqual({
      kind: 'near',
      edge: [6.52, 48.7],
    });
    expect(openingPlan(bbox, 5.84 - lonDeg, 48.7)).toEqual({
      kind: 'near',
      edge: [5.84, 48.7],
    });
    expect(openingPlan(bbox, 6.2, 48.47 - deg)).toEqual({
      kind: 'near',
      edge: [6.2, 48.47],
    });
    expect(openingPlan(bbox, 6.2, 48.92 + deg)).toEqual({
      kind: 'near',
      edge: [6.2, 48.92],
    });
  });

  it('uses the corner as the edge near a corner', () => {
    expect(openingPlan(bbox, 6.52 + 0.02, 48.92 + 0.02)).toEqual({
      kind: 'near',
      edge: [6.52, 48.92],
    });
  });

  it('switches from near to far at 10 km (haversine)', () => {
    const at = (meters: number) => 48.47 - meters / 111_195;
    const edgeAt = (lat: number) =>
      distanceMeters({ lon: 6.2, lat }, { lon: 6.2, lat: 48.47 });
    // The reference distances are real ones.
    expect(edgeAt(at(9900))).toBeCloseTo(9900, -1);
    expect(openingPlan(bbox, 6.2, at(9900)).kind).toBe('near');
    expect(openingPlan(bbox, 6.2, at(10_100)).kind).toBe('far');
    expect(NEAR_ZONE_M).toBe(10_000);
  });
});

describe('nearCenter', () => {
  it('moves the edge about 0.1 m inside the zone', () => {
    expect(nearCenter(bbox, [6.52, 48.7])).toEqual([6.52 - 0.000001, 48.7]);
    expect(nearCenter(bbox, [5.84, 48.7])).toEqual([5.84 + 0.000001, 48.7]);
    expect(nearCenter(bbox, [6.2, 48.47])).toEqual([6.2, 48.47 + 0.000001]);
    expect(nearCenter(bbox, [6.2, 48.92])).toEqual([6.2, 48.92 - 0.000001]);
  });

  it('moves both coordinates at a corner, and stays in the rectangle', () => {
    const [lon, lat] = nearCenter(bbox, [6.52, 48.92]);
    expect(lon).toBeLessThan(6.52);
    expect(lat).toBeLessThan(48.92);
    expect(lon).toBeGreaterThanOrEqual(bbox.lonMin);
    expect(lat).toBeGreaterThanOrEqual(bbox.latMin);
  });
});

describe('nearZoom', () => {
  it('is 14 at most, even for a position at the edge', () => {
    expect(nearZoom([6.52, 48.7], [6.52001, 48.7], MAP, KEEP)).toBe(14);
    expect(nearZoom([6.52, 48.7], [6.52, 48.7], MAP, KEEP)).toBe(14);
  });

  it('is about 11.6 for a position 2.5 km east (mockup 90)', () => {
    const position: [number, number] = [6.52 + eastOf(2500, 48.7), 48.7];
    expect(nearZoom([6.52, 48.7], position, MAP, KEEP)).toBeCloseTo(11.6, 1);
  });

  it('is about 9.6 for a position 10 km to the east', () => {
    const position: [number, number] = [6.52 + eastOf(10_000, 48.7), 48.7];
    expect(nearZoom([6.52, 48.7], position, MAP, KEEP)).toBeCloseTo(9.6, 1);
  });

  it('keeps 140 above and the bottom margin under the center', () => {
    const km5 = 5000 / 111_195;
    const above = nearZoom([6.2, 48.92], [6.2, 48.92 + km5], MAP, KEEP);
    const below = nearZoom([6.2, 48.47], [6.2, 48.47 - km5], MAP, KEEP);
    // The room above is smaller than under (140 against 112).
    expect(MAP.height / 2 - 140).toBeLessThan(MAP.height / 2 - 112);
    expect(above).toBeLessThan(below);
    // Position at the limit: its offset on screen is exactly the room.
    const y = (lat: number) => {
      const s = Math.sin((lat * Math.PI) / 180);
      return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 512;
    };
    expect(Math.abs(y(48.92 + km5) - y(48.92)) * 2 ** above).toBeCloseTo(
      MAP.height / 2 - 140,
      3,
    );
    expect(Math.abs(y(48.47 - km5) - y(48.47)) * 2 ** below).toBeCloseTo(
      MAP.height / 2 - 112,
      3,
    );
  });

  it('lets the tightest side decide', () => {
    const east = eastOf(2500, 48.7);
    const north = 8000 / 111_195;
    const zoom = nearZoom([6.52, 48.8], [6.52 + east, 48.8 + north], MAP, KEEP);
    const onlyNorth = nearZoom([6.52, 48.8], [6.52, 48.8 + north], MAP, KEEP);
    const onlyEast = nearZoom([6.52, 48.8], [6.52 + east, 48.8], MAP, KEEP);
    expect(zoom).toBeCloseTo(Math.min(onlyNorth, onlyEast), 10);
  });
});
