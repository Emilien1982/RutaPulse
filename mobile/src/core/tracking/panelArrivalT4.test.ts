// Phase 8b, T4 (ADR 0021, section 11.1): on the arrival, the panel and
// "Reste" give the same distance; under 30 m the panel only says "Arrivée".
import { initialPlacement } from './placement';
import { buildLine, type TrackingSource } from './trackingLine';
import {
  createTracking,
  panelNumber,
  panelOf,
  remainingOf,
  type TrackingState,
} from './trackingState';

const line = buildLine([
  [6, 48.7],
  [6.03, 48.7],
]);
const source: TrackingSource = { line, free: [] };
const L = line.lengthM;

function at(progressM: number): TrackingState {
  return {
    ...createTracking(source, 0),
    hasFix: true,
    placement: {
      ...initialPlacement(),
      phase: 'onTrack',
      prev: [6, 48.7],
      progressM,
    },
  };
}

describe('the arrival panel', () => {
  it('gives the distance of "Reste"', () => {
    for (const left of [90, 40, 12, 0]) {
      const state = at(L - left);
      const panel = panelOf(state);
      expect(panel.kind).toBe('arrive');
      expect(panel.distanceM).toBeCloseTo(remainingOf(state), 6);
    }
  });

  it('shows no number under 30 m, and "40 m" at 40 m', () => {
    expect(panelNumber(panelOf(at(L - 29)))).toBeNull();
    expect(panelNumber(panelOf(at(L)))).toBeNull();
    expect(panelNumber(panelOf(at(L - 40)))).toEqual({
      value: '40',
      unit: 'm',
    });
  });

  it('shows the number of a panel that is not the arrival', () => {
    expect(panelNumber(panelOf(at(500)))).not.toBeNull();
    expect(panelNumber(panelOf(createTracking(source, 0)))).toBeNull();
  });
});
