import iosSuccess from '../routing/fixtures/ios-success.json';
import { decodePolyline6 } from '../routing/routeResponse';
import { readGpx } from './readGpx';
import { trackLengthM } from './trackLengthM';
import { writeGpx } from './writeGpx';

describe('write then read', () => {
  const track = decodePolyline6(iosSuccess.trip.legs[0].shape);
  const elevations = track.map((_p, i) =>
    i % 3 === 0 ? null : 200 + (i % 40),
  );

  it('gives the same track to 1 m and the same length to 10 m', () => {
    const name = 'Côte & "Forêt" <1>';
    const back = readGpx(writeGpx({ name, track, elevations }));
    if (!back.ok) throw new Error(back.reason);
    expect(back.name).toBe(name);
    // Valhalla points are already at 6 decimals: the track must be identical.
    expect(back.track).toEqual(
      track.filter(
        (p, i) =>
          i === 0 || p[0] !== track[i - 1][0] || p[1] !== track[i - 1][1],
      ),
    );
    expect(
      Math.abs(trackLengthM(back.track) - trackLengthM(track)),
    ).toBeLessThan(1);
    expect(back.elevations.filter((e) => e !== null).length).toBeGreaterThan(0);
  });

  it('keeps altitudes rounded to a tenth and null when unknown', () => {
    const back = readGpx(
      writeGpx({
        name: 'A',
        track: [
          [1, 1],
          [2, 2],
        ],
        elevations: [212.46, null],
      }),
    );
    expect(back).toMatchObject({ ok: true, elevations: [212.5, null] });
  });

  it('reads longitude 180 back as -180 (schema bound)', () => {
    const back = readGpx(
      writeGpx({
        name: 'A',
        track: [
          [180, 1],
          [179, 2],
        ],
      }),
    );
    expect(back).toMatchObject({
      ok: true,
      track: [
        [-180, 1],
        [179, 2],
      ],
    });
  });
});
