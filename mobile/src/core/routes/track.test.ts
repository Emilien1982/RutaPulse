import { decodePolyline6 } from '@/core/routing/routeResponse';

import type { SavedLeg } from './savedRoute';
import {
  previewOf,
  thinTrack,
  trackInside,
  trackLengthKm,
  trackOfCreated,
} from './track';

const bbox = { lonMin: 6, latMin: 48, lonMax: 7, latMax: 49 };
const path = (shape: [number, number][]): SavedLeg => ({
  mode: 'path',
  zoneVersion: 3,
  distanceKm: 1,
  durationS: 60,
  shape,
});

describe('trackOfCreated', () => {
  it('joins the shapes and drops a repeated point', () => {
    const draft = {
      points: [1, 2, 3].map((id) => ({ id, lon: 6 + id / 10, lat: 48.5 })),
      modes: ['path', 'path'] as ('path' | 'hand')[],
    };
    const track = trackOfCreated(draft, [
      path([
        [6.1, 48.5],
        [6.15, 48.51],
        [6.2, 48.5],
      ]),
      path([
        [6.2, 48.5],
        [6.3, 48.5],
      ]),
    ]);
    expect(track).toEqual([
      [6.1, 48.5],
      [6.15, 48.51],
      [6.2, 48.5],
      [6.3, 48.5],
    ]);
  });

  it('goes through the snapped end of a computed leg, not the placed point', () => {
    const draft = {
      points: [
        { id: 1, lon: 6.1, lat: 48.5 },
        { id: 2, lon: 6.2001, lat: 48.5001 },
        { id: 3, lon: 6.3, lat: 48.5 },
      ],
      modes: ['path', 'hand'] as ('path' | 'hand')[],
    };
    const track = trackOfCreated(draft, [
      path([
        [6.1, 48.5],
        [6.2, 48.5],
      ]),
      { mode: 'hand' },
    ]);
    expect(track).toEqual([
      [6.1, 48.5],
      [6.2, 48.5],
      [6.3, 48.5],
    ]);
  });

  it('keeps both points of a hand leg alone', () => {
    const draft = {
      points: [
        { id: 1, lon: 6.1, lat: 48.5 },
        { id: 2, lon: 6.2, lat: 48.5 },
      ],
      modes: ['hand'] as ('path' | 'hand')[],
    };
    expect(trackOfCreated(draft, [{ mode: 'hand' }])).toEqual([
      [6.1, 48.5],
      [6.2, 48.5],
    ]);
  });
});

describe('thinTrack', () => {
  const line = Array.from(
    { length: 1000 },
    (_, i) => [6 + i * 0.0001, 48.5] as [number, number],
  );

  it('returns the track as is under the limit', () => {
    expect(thinTrack(line, 1000)).toBe(line);
  });

  it('keeps the ends and stays near the limit, without changing the input', () => {
    const copy = [...line];
    const thin = thinTrack(line, 100);
    expect(thin[0]).toEqual(line[0]);
    expect(thin[thin.length - 1]).toEqual(line[line.length - 1]);
    expect(thin.length).toBeLessThanOrEqual(102);
    expect(thin.length).toBeGreaterThan(50);
    expect(line).toEqual(copy);
  });
});

describe('previewOf', () => {
  it('has 66 points at most, ends included', () => {
    const line = Array.from(
      { length: 500 },
      (_, i) => [6 + i * 0.001, 48.5] as [number, number],
    );
    const points = decodePolyline6(previewOf(line));
    expect(points).toHaveLength(66);
    expect(points[0][0]).toBeCloseTo(6, 5);
    expect(points[65][0]).toBeCloseTo(6.499, 5);
  });

  it('keeps a short track whole', () => {
    expect(
      decodePolyline6(
        previewOf([
          [6, 48],
          [6.1, 48.1],
        ]),
      ),
    ).toHaveLength(2);
  });
});

describe('length and rectangle', () => {
  it('measures 1 degree of latitude as about 111 km', () => {
    expect(
      trackLengthKm([
        [6, 48],
        [6, 49],
      ]),
    ).toBeCloseTo(111.32, 1);
  });

  it('says whether every point is inside, edges included', () => {
    expect(
      trackInside(bbox, [
        [6, 48],
        [7, 49],
      ]),
    ).toBe(true);
    expect(
      trackInside(bbox, [
        [6, 48],
        [7.01, 49],
      ]),
    ).toBe(false);
  });
});
