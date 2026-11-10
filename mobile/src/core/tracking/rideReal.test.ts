// The real figures of the end screen (ADR 0021, section 4; spec C6, C7).
import {
  addRideFix,
  rideAscentM,
  rideDurationS,
  rideHeightShape,
  startRide,
} from './ride';
import { toLonLat } from './testing/fabricate';
import type { Fix } from './placement';

const bbox = { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49 };

function fixAt(x: number, at: number): Fix {
  const [lon, lat] = toLonLat([x, 0]);
  return { lon, lat, accuracy: 5, at };
}
function rideOf(xs: number[]) {
  return xs.reduce(
    (ride, x, i) => addRideFix(ride, fixAt(x, 1000 * i)),
    startRide(0),
  );
}

describe('rideHeightShape', () => {
  it('is the positions kept, for one request', () => {
    const shape = rideHeightShape(rideOf([0, 50, 100, 150]), bbox);
    expect(shape).toHaveLength(4);
  });

  it('keeps at most 14 000 points', () => {
    const xs = Array.from({ length: 20_000 }, (_, i) => i * 12);
    const shape = rideHeightShape(rideOf(xs), {
      lonMin: 5,
      latMin: 48,
      lonMax: 12,
      latMax: 49,
    });
    expect(shape).not.toBeNull();
    expect(shape!.length).toBeLessThanOrEqual(14_000);
  });

  it('is null outside the zone, without zone, or with one position', () => {
    const far = { lonMin: 0, latMin: 0, lonMax: 1, latMax: 1 };
    expect(rideHeightShape(rideOf([0, 50, 100]), far)).toBeNull();
    expect(rideHeightShape(rideOf([0, 50, 100]), null)).toBeNull();
    expect(rideHeightShape(rideOf([0]), bbox)).toBeNull();
  });
});

describe('real ascent and duration', () => {
  it('sums only the climbs of the altitudes of the engine', () => {
    expect(
      rideAscentM({
        ok: true,
        profile: [
          [0, 100],
          [30, 110],
          [60, 105],
          [90, 120],
        ],
      }),
    ).toBe(25);
  });

  it('is unknown ("—") on a failure, never the altitude of the GPS', () => {
    expect(rideAscentM({ ok: false, error: 'failed' })).toBeNull();
  });

  it('counts the pauses in the duration: start to end by the clock', () => {
    const ride = startRide(1_000_000);
    expect(rideDurationS(ride, 1_000_000 + 112 * 60_000)).toBe(112 * 60);
  });
});
