import { initialPlacement } from '@/core/tracking/placement';
import { lineOf, straight } from '@/core/tracking/testing/fabricate';
import { buildLine } from '@/core/tracking/trackingLine';

import {
  drawnLine,
  gapDots,
  gapLine,
  metersPerPoint,
  ridePieces,
  targetPoint,
} from './trackingGeometry';

const line = buildLine(lineOf(straight(1000)));

describe('ridePieces', () => {
  it('draws nothing grey at the start, all of the line ahead', () => {
    const { done, todo } = ridePieces(drawnLine(line, []), 0);
    expect(done.features).toHaveLength(0);
    expect(todo.features).toHaveLength(1);
    expect(todo.features[0]?.properties.mode).toBe('path');
  });

  it('cuts the line at the progress', () => {
    const { done, todo } = ridePieces(drawnLine(line, []), 400);
    expect(done.features).toHaveLength(1);
    expect(todo.features).toHaveLength(1);
    const end = done.features[0]?.geometry.coordinates.at(-1);
    const start = todo.features[0]?.geometry.coordinates[0];
    expect(end).toEqual(start);
  });

  it('keeps a hand stretch dashed, and drops the part already ridden of it', () => {
    const free = [{ fromM: 300, toM: 600, reason: 'hand' as const }];
    const early = ridePieces(drawnLine(line, free), 100).todo.features;
    expect(early.map((f) => f.properties.mode)).toEqual([
      'path',
      'hand',
      'path',
    ]);
    const inside = ridePieces(drawnLine(line, free), 450).todo.features;
    expect(inside.map((f) => f.properties.mode)).toEqual(['hand', 'path']);
    const after = ridePieces(drawnLine(line, free), 800).todo.features;
    expect(after.map((f) => f.properties.mode)).toEqual(['path']);
  });

  it('does not draw a stretch out of the zone as a hand stretch', () => {
    const free = [{ fromM: 300, toM: 600, reason: 'outOfZone' as const }];
    const todo = ridePieces(drawnLine(line, free), 0).todo.features;
    expect(todo.map((f) => f.properties.mode)).toEqual(['path']);
  });
});

describe('drawnLine', () => {
  it('thins a line of more than 5 000 points', () => {
    const points = lineOf(
      Array.from({ length: 9000 }, (_, i): [number, number] => [i, 0]),
    );
    const drawn = drawnLine(buildLine(points), []);
    expect(drawn.line.points.length).toBeLessThanOrEqual(5000);
    expect(drawn.line.lengthM).toBeCloseTo(8999, -1);
  });
});

describe('gap line', () => {
  it('goes from the rider to the start while approaching', () => {
    const placement = {
      ...initialPlacement(),
      prev: [line.points[0][0], line.points[0][1] + 0.004] as [number, number],
      gapM: 440,
    };
    expect(targetPoint(line, placement)).toEqual(line.points[0]);
    expect(gapLine(line, placement).features).toHaveLength(1);
  });

  it('is empty on the track', () => {
    const placement = {
      ...initialPlacement(),
      phase: 'onTrack' as const,
      snapped: line.points[3],
      prev: line.points[3],
    };
    expect(gapLine(line, placement).features).toHaveLength(0);
  });
});

describe('gap dots', () => {
  it('puts a dot every spacing, round on both platforms, none at the ends', () => {
    const from: [number, number] = [6, 48.7];
    const to: [number, number] = [6, 48.7 + 95 / 111195];
    const dots = gapDots(from, to, 10);
    expect(dots.features).toHaveLength(9);
    expect(dots.features[0]?.geometry.type).toBe('Point');
  });

  it('is empty without spacing, and bounded for a very long gap', () => {
    const from: [number, number] = [6, 48.7];
    expect(gapDots(from, [6, 49], 0).features).toHaveLength(0);
    expect(gapDots(from, [6, 49], 1).features.length).toBeLessThanOrEqual(300);
  });

  it('measures the ground distance of a point of the screen', () => {
    // 15.5: about 1.1 m per point at 48.7 N (tiles of 512 points).
    expect(metersPerPoint(15.5, 48.7)).toBeCloseTo(1.1, 1);
  });
});
