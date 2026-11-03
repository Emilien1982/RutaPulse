import iosSuccess from '../routing/fixtures/ios-success.json';
import { decodePolyline6 } from '../routing/routeResponse';
import { trackLengthM, VALHALLA_EARTH_RADIUS_M } from './trackLengthM';

describe('trackLengthM', () => {
  it('is 0 for fewer than 2 points', () => {
    expect(trackLengthM([])).toBe(0);
    expect(trackLengthM([[6, 48]])).toBe(0);
  });

  it('measures one degree of latitude on the Valhalla sphere', () => {
    const expected = (VALHALLA_EARTH_RADIUS_M * Math.PI) / 180;
    expect(
      trackLengthM([
        [6, 48],
        [6, 49],
      ]),
    ).toBeCloseTo(expected, 3);
    expect(VALHALLA_EARTH_RADIUS_M).toBe(6378160);
  });

  it('matches the length given by the engine (real answer, 5.918 km)', () => {
    const shape = decodePolyline6(iosSuccess.trip.legs[0].shape);
    const engineM = iosSuccess.trip.summary.length * 1000;
    expect(Math.abs(trackLengthM(shape) - engineM)).toBeLessThan(5);
  });
});
