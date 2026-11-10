// Phase 8a, T3 correction: a route with no direction at all (GPX out of the
// zone, zone deleted) says "Suivez le tracé" all along, with the distance and
// the reason; only the last 100 m become the arrival in sight.
import type { Direction } from './directionText';
import { initialPlacement } from './placement';
import { buildLine, type TrackingSource } from './trackingLine';
import { createTracking, panelOf, type TrackingState } from './trackingState';

const line = buildLine([
  [6, 48.7],
  [6.03, 48.7],
]);
const source: TrackingSource = {
  line,
  free: [{ fromM: 0, toM: line.lengthM, reason: 'outOfZone' }],
};
const L = line.lengthM;

function at(progressM: number): TrackingState {
  const base = createTracking(source, 0);
  return {
    ...base,
    hasFix: true,
    placement: {
      ...initialPlacement(),
      phase: 'onTrack',
      prev: [6, 48.7],
      progressM,
    },
  };
}

describe('a route without any direction', () => {
  it('has one stretch to the end, then the arrival', () => {
    expect(createTracking(source, 0).directions.map((d) => d.kind)).toEqual([
      'follow',
      'arrive',
    ]);
  });

  it('says "Suivez le tracé" with the distance to the end and the reason', () => {
    const panel = panelOf(at(500));
    expect(panel).toMatchObject({
      kind: 'follow',
      reason: 'outOfZone',
      imminent: false,
    });
    expect(panel.distanceM).toBeCloseTo(L - 500, 0);
    expect((panel.direction as Direction).kind).toBe('follow');
  });

  it('stays white and "follow" at 101 m from the arrival', () => {
    const panel = panelOf(at(L - 101));
    expect(panel.kind).toBe('follow');
    expect(panel.imminent).toBe(false);
  });

  it('shows the arrival in sight, yellow, at 100 m or less', () => {
    const panel = panelOf(at(L - 100));
    expect(panel).toMatchObject({
      kind: 'arrive',
      reason: 'outOfZone',
      imminent: true,
    });
    expect((panel.direction as Direction).kind).toBe('arrive');
    expect(panelOf(at(L - 20)).kind).toBe('arrive');
  });

  it('does not give a reason when the engine missed the stretch', () => {
    const lost: TrackingSource = {
      line,
      free: [{ fromM: 0, toM: L, reason: 'noMatch' }],
    };
    const state = {
      ...at(500),
      directions: createTracking(lost, 0).directions,
    };
    expect(panelOf(state)).toMatchObject({ kind: 'follow', reason: null });
  });
});
