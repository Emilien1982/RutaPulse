import { trailRouteName } from '@/core/routes/routeName';

import { trailTitle } from './trailSummary';
import { CHEVRON_BANDS } from './chevrons';
import { mapLabel, type Trail } from './trails';

const trail = (ref: string) => ({ name: null, ref }) as unknown as Trail;

describe('L6: a ref that already says "Circuit"', () => {
  it('adds "Circuit" to a plain number', () => {
    expect(mapLabel(trail('3'))).toBe('Circuit 3');
    expect(trailTitle(trail('3'))).toBe('Circuit 3');
  });

  it('does not repeat it, whatever the case', () => {
    for (const ref of ['Circuit 3', 'circuit 3', 'CIRCUIT 3']) {
      expect(mapLabel(trail(ref))).toBe(ref);
      expect(trailTitle(trail(ref))).toBe(ref);
      expect(trailRouteName(trail(ref), new Date(2026, 10, 9))).toBe(ref);
    }
  });

  it('keeps a ref that only starts with the letters', () => {
    expect(mapLabel(trail('Circuiterie 2'))).toBe('Circuit Circuiterie 2');
  });
});

describe('M4: no chevron under the zoom 10', () => {
  it('the first band starts at 10', () => {
    expect(CHEVRON_BANDS[0].minZoom).toBe(10);
  });
});
