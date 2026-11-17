import {
  haloRadiusAtZoom0,
  metersPerPoint,
  nextHeading,
  puckFeature,
  type HeadingState,
} from './userPuck';

const NONE: HeadingState = { heading: null, slowSince: null };

describe('nextHeading', () => {
  it('shows no arrow at once without a heading', () => {
    const moving: HeadingState = { heading: 90, slowSince: null };
    expect(nextHeading(moving, { heading: null, speed: 3 }, 0)).toEqual(NONE);
  });

  it('shows no arrow for a heading that is not a degree value', () => {
    const moving: HeadingState = { heading: 90, slowSince: null };
    expect(
      nextHeading(moving, { heading: 361, speed: 3 }, 0).heading,
    ).toBeNull();
    expect(
      nextHeading(moving, { heading: -1, speed: 3 }, 0).heading,
    ).toBeNull();
    expect(
      nextHeading(moving, { heading: NaN, speed: 3 }, 0).heading,
    ).toBeNull();
  });

  it('takes the heading at 2 m/s', () => {
    expect(nextHeading(NONE, { heading: 187, speed: 2 }, 1000)).toEqual({
      heading: 187,
      slowSince: null,
    });
  });

  it('takes the heading when the speed is unknown', () => {
    expect(nextHeading(NONE, { heading: 45, speed: null }, 1000).heading).toBe(
      45,
    );
  });

  it('keeps the last heading for 4 s under 0.5 m/s', () => {
    let state = nextHeading(NONE, { heading: 120, speed: 2 }, 0);
    for (let at = 1000; at <= 5000; at += 1000) {
      state = nextHeading(state, { heading: 300, speed: 0.3 }, at);
    }
    // 4 s under the speed (from 1000 to 5000): the last real heading stays.
    expect(state.heading).toBe(120);
  });

  it('hides the arrow after more than 5 s under 0.5 m/s', () => {
    let state = nextHeading(NONE, { heading: 120, speed: 2 }, 0);
    for (let at = 1000; at <= 7000; at += 1000) {
      state = nextHeading(state, { heading: 300, speed: 0.3 }, at);
    }
    expect(state.heading).toBeNull();
  });

  it('does not hide the arrow at exactly 5 s', () => {
    let state = nextHeading(NONE, { heading: 120, speed: 2 }, 0);
    state = nextHeading(state, { heading: 120, speed: 0.1 }, 1000);
    state = nextHeading(state, { heading: 120, speed: 0.1 }, 6000);
    expect(state.heading).toBe(120);
  });

  it('shows the arrow again when the speed comes back', () => {
    let state = nextHeading(NONE, { heading: 120, speed: 2 }, 0);
    for (let at = 1000; at <= 7000; at += 1000) {
      state = nextHeading(state, { heading: 300, speed: 0.3 }, at);
    }
    state = nextHeading(state, { heading: 10, speed: 1.5 }, 8000);
    expect(state).toEqual({ heading: 10, slowSince: null });
  });

  it('starts the delay again after a move', () => {
    let state = nextHeading(NONE, { heading: 120, speed: 2 }, 0);
    state = nextHeading(state, { heading: 120, speed: 0.2 }, 1000);
    state = nextHeading(state, { heading: 130, speed: 2 }, 4000);
    state = nextHeading(state, { heading: 130, speed: 0.2 }, 8000);
    expect(state.heading).toBe(130);
  });
});

describe('haloRadiusAtZoom0', () => {
  it('gives 12.7 points at zoom 17 for 5 m in Nancy (essay T1)', () => {
    expect(haloRadiusAtZoom0(5, 48.69) * 2 ** 17).toBeCloseTo(12.7, 1);
  });

  it('gives 25.4 points at zoom 15 for 40 m (mockup 90)', () => {
    expect(haloRadiusAtZoom0(40, 48.8) * 2 ** 15).toBeCloseTo(25.4, 0);
  });
});

describe('metersPerPoint', () => {
  it('is about 1.1 m at zoom 15.5 in Nancy', () => {
    expect(metersPerPoint(15.5, 48.7)).toBeCloseTo(1.1, 1);
  });
});

describe('puckFeature', () => {
  it('puts the heading and the halo radius on the point', () => {
    const f = puckFeature(
      { longitude: 6.18, latitude: 48.69, accuracy: 5 },
      187,
    );
    expect(f.geometry.coordinates).toEqual([6.18, 48.69]);
    expect(f.properties.heading).toBe(187);
    expect(f.properties.r0).toBeCloseTo(haloRadiusAtZoom0(5, 48.69), 12);
  });

  it('leaves out the heading when there is none', () => {
    const f = puckFeature({ longitude: 6, latitude: 48, accuracy: 5 }, null);
    expect('heading' in f.properties).toBe(false);
  });

  it('leaves out the halo when the accuracy is unknown', () => {
    expect(
      'r0' in puckFeature({ longitude: 6, latitude: 48 }, 10).properties,
    ).toBe(false);
    expect(
      'r0' in
        puckFeature({ longitude: 6, latitude: 48, accuracy: null }, 10)
          .properties,
    ).toBe(false);
  });
});
