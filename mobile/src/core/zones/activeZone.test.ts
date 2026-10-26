import type { Zone } from './catalogue';
import { clampToBbox, isInsideBbox, pickActiveZone } from './activeZone';
import type { ReadyMarker } from './zoneLayout';

const bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };

function marker(id: string, version: number, installedAt: string): ReadyMarker {
  const zone: Zone = {
    id,
    name: id,
    version,
    bbox,
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 1,
    files: [],
  };
  return { localFormat: 1, installedAt, zone };
}

describe('pickActiveZone', () => {
  it('returns null without any ready zone', () => {
    expect(pickActiveZone([])).toBeNull();
  });

  it('returns the only zone', () => {
    const m = marker('nancy', 3, '2026-10-25T10:00:00.000Z');
    expect(pickActiveZone([m])).toBe(m.zone);
  });

  it('returns the zone installed most recently', () => {
    const old = marker('nancy', 3, '2026-10-24T10:00:00.000Z');
    const recent = marker('metz', 1, '2026-10-25T10:00:00.000Z');
    expect(pickActiveZone([recent, old])).toBe(recent.zone);
    expect(pickActiveZone([old, recent])).toBe(recent.zone);
  });
});

describe('isInsideBbox', () => {
  it('accepts a point in Nancy', () => {
    expect(isInsideBbox(bbox, 6.1844, 48.6921)).toBe(true);
  });

  it('accepts the edges', () => {
    expect(isInsideBbox(bbox, 5.84, 48.47)).toBe(true);
    expect(isInsideBbox(bbox, 6.52, 48.92)).toBe(true);
  });

  it('refuses points outside, on each side', () => {
    expect(isInsideBbox(bbox, 2.35, 48.85)).toBe(false); // Paris, west
    expect(isInsideBbox(bbox, 7.75, 48.7)).toBe(false); // east
    expect(isInsideBbox(bbox, 6.1, 49.5)).toBe(false); // north
    expect(isInsideBbox(bbox, 6.1, 47.9)).toBe(false); // south
  });
});

describe('clampToBbox', () => {
  it('keeps a point inside the zone', () => {
    expect(clampToBbox(bbox, 6.1844, 48.6921)).toEqual([6.1844, 48.6921]);
  });

  it('brings Metz (north) to the north edge', () => {
    expect(clampToBbox(bbox, 6.1757, 49.1193)).toEqual([6.1757, 48.92]);
  });

  it('brings a point to the west edge', () => {
    expect(clampToBbox(bbox, 2.35, 48.7)).toEqual([5.84, 48.7]);
  });

  it('brings a point in a corner to the corner', () => {
    expect(clampToBbox(bbox, 7.75, 47.5)).toEqual([6.52, 48.47]);
  });

  it('always gives a point inside the zone', () => {
    const [lon, lat] = clampToBbox(bbox, -20, 80);
    expect(isInsideBbox(bbox, lon, lat)).toBe(true);
  });
});
