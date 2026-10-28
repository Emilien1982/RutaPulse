import {
  classifyEdge,
  roundShares,
  terrainSegments,
  terrainShares,
  handSegment,
} from './terrain';
import { parseTraceResponse } from '../routing/infoResponse';
import type { TerrainEdge } from '../routing/infoResponse';

import iosAb from '../routing/fixtures/infos/ios-AB-trace-walk_or_snap.json';
import iosR4 from '../routing/fixtures/infos/ios-R4-trace-walk_or_snap.json';

const edge = (use: string, density: number, lengthKm = 1): TerrainEdge => ({
  use,
  density,
  lengthKm,
});

const edgesOf = (record: { response: unknown }): TerrainEdge[] => {
  const result = parseTraceResponse(JSON.stringify(record.response));
  if (!result.ok) throw new Error('unreadable fixture');
  return result.edges;
};

describe('classifyEdge', () => {
  it('track is a track whatever the density', () => {
    expect(classifyEdge(edge('track', 0))).toBe('track');
    expect(classifyEdge(edge('track', 9))).toBe('track');
  });
  it.each([
    'path',
    'footway',
    'mountain_bike',
    'cycleway',
    'pedestrian',
    'bridleway',
    'steps',
    'sidewalk',
  ])('%s is a trail below density 6', (use) => {
    expect(classifyEdge(edge(use, 5))).toBe('trail');
    expect(classifyEdge(edge(use, 0))).toBe('trail');
    expect(classifyEdge(edge(use, 6))).toBe('road');
  });
  it.each(['road', 'service_road', 'living_street', 'driveway', 'weird', ''])(
    '%s is a road',
    (use) => {
      expect(classifyEdge(edge(use, 0))).toBe('road');
    },
  );
});

describe('roundShares', () => {
  it('always sums to 100', () => {
    expect(roundShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundShares([1, 1, 1, 1, 1, 1, 1]).reduce((a, b) => a + b)).toBe(
      100,
    );
    expect(roundShares([25.271, 12.546, 62.184])).toEqual([25, 13, 62]);
  });
  it('breaks ties in the order of the list', () => {
    expect(roundShares([1, 1, 1, 0])).toEqual([34, 33, 33, 0]);
    expect(roundShares([0, 1, 1, 1])).toEqual([0, 34, 33, 33]);
  });
  it('is all zeros on an empty base', () => {
    expect(roundShares([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('terrainShares', () => {
  it('lists road, track and trail even at 0 %, hand only when present', () => {
    expect(terrainShares([edge('road', 0, 2)], 0)).toEqual([
      { part: 'road', percent: 100 },
      { part: 'track', percent: 0 },
      { part: 'trail', percent: 0 },
    ]);
    expect(terrainShares([edge('road', 0, 0.6)], 0.4)).toEqual([
      { part: 'road', percent: 60 },
      { part: 'track', percent: 0 },
      { part: 'trail', percent: 0 },
      { part: 'hand', percent: 40 },
    ]);
  });
  it('is null on an empty base', () => {
    expect(terrainShares([], 0)).toBeNull();
  });
  // Reference: `python3 -I scripts/ascent_reference.py` (terrain part).
  it('real A-B: 62 / 38 / 0', () => {
    expect(terrainShares(edgesOf(iosAb), 0)?.map((s) => s.percent)).toEqual([
      62, 38, 0,
    ]);
  });
  it('real R4: 25 / 13 / 62 (sum 100 although the edges miss 1 %)', () => {
    expect(terrainShares(edgesOf(iosR4), 0)?.map((s) => s.percent)).toEqual([
      25, 13, 62,
    ]);
  });
});

describe('terrainSegments', () => {
  it('merges neighbours and scales to the leg length', () => {
    expect(
      terrainSegments(
        [edge('road', 0, 1), edge('service_road', 0, 1), edge('track', 0, 2)],
        400,
        100,
      ),
    ).toEqual([
      { part: 'road', fromM: 100, toM: 300 },
      { part: 'track', fromM: 300, toM: 500 },
    ]);
  });
  it('gives nothing without edges', () => {
    expect(terrainSegments([], 100, 0)).toEqual([]);
  });
  it('makes a hand segment', () => {
    expect(handSegment(60, 10)).toEqual({ part: 'hand', fromM: 10, toM: 70 });
  });
});
