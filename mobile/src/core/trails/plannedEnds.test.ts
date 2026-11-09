// Start and end markers of a chosen circuit (C6, mockup 12).
import nancy from '@/core/routes/fixtures/nancyCircuits.json';
import type { LonLat } from '@/core/routes/savedRoute';

import { nancyTrails } from './testing';
import { plannedEnds, type Trail } from './trails';

const loop = nancyTrails()[0] as Trail;
const line = nancy.circuits[0].ordered as LonLat[];

const oneWay: Trail = {
  ...loop,
  line: {
    kind: 'ordered',
    ordered: [
      [6.0, 48.0],
      [6.01, 48.0],
      [6.02, 48.01],
    ],
    loop: false,
    orderedM: 2500,
    removedM: 0,
  },
};

describe('plannedEnds', () => {
  it('a loop with an unknown position starts at the beginning, with no end marker', () => {
    expect(plannedEnds(loop, null)).toEqual({ start: line[0], end: null });
  });

  it('a loop starts at the point nearest to the position', () => {
    const near: LonLat = [line[300][0] + 0.0005, line[300][1] + 0.0002];
    const ends = plannedEnds(loop, near);
    expect(ends?.end).toBeNull();
    expect(ends?.start[0]).toBeCloseTo(line[300][0], 3);
    expect(ends?.start[1]).toBeCloseTo(line[300][1], 3);
  });

  it('a one-way circuit starts at its beginning whatever the position', () => {
    expect(plannedEnds(oneWay, [6.02, 48.01])).toEqual({
      start: [6.0, 48.0],
      end: [6.02, 48.01],
    });
  });

  it('gives nothing when the order is unknown', () => {
    expect(plannedEnds({ ...loop, line: { kind: 'old' } }, null)).toBeNull();
  });
});
