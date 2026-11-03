import { readGpx } from '../gpx/readGpx';
import { trackLengthM } from '../gpx/trackLengthM';
import { buildRouteGpx, exportTrackOf } from './exportGpx';
import type { CreatedRoute, GpxRoute } from './savedRoute';
import { sampleCreated, sampleGpx } from './testing/sampleRoutes';
import { trackOfCreated } from './track';

const created = (): CreatedRoute => ({
  ...sampleCreated(),
  id: 1,
  readable: true,
});
const gpx = (patch: Partial<GpxRoute> = {}): GpxRoute => ({
  ...sampleGpx(),
  id: 2,
  readable: true,
  ...patch,
});

describe('exportTrackOf', () => {
  it('is the track of a GPX as it is', () => {
    expect(exportTrackOf(gpx())).toEqual(gpx().track);
  });

  it('is the track of a created route, without the link line', () => {
    const route = created();
    expect(exportTrackOf(route)).toEqual(
      trackOfCreated(route.draft, route.legs),
    );
  });
});

describe('buildRouteGpx', () => {
  it('names the file after the route and writes the name', () => {
    const { fileName, text } = buildRouteGpx(
      { ...gpx(), name: 'A/B: "x"' },
      null,
    );
    expect(fileName).toBe('A-B- -x-.gpx');
    expect(text).toContain('<name>A/B: &quot;x&quot;</name>');
  });

  it('has no wpt, no time and no extensions', () => {
    const { text } = buildRouteGpx(gpx(), null);
    expect(text).not.toMatch(/<wpt|<time|<extensions/);
  });

  it('writes the altitudes of a GPX where they are known', () => {
    const { text } = buildRouteGpx(gpx(), null);
    expect(text).toContain('<ele>212</ele>');
    expect(text).toContain('<ele>215.5</ele>');
    expect(text.match(/<ele>/g)).toHaveLength(2);
  });

  it('writes the heights of a created route', () => {
    const route = created();
    const n = exportTrackOf(route).length;
    const heights = Array.from({ length: n }, (_v, i) => 200 + i);
    const { text } = buildRouteGpx(route, heights);
    expect(text.match(/<ele>/g)).toHaveLength(n);
    expect(text).toContain('<ele>200</ele>');
  });

  it('writes no <ele> for a created route without heights', () => {
    const { text } = buildRouteGpx(created(), null);
    expect(text).not.toContain('<ele>');
    expect(text).toContain('<trkpt');
  });
});

describe('C11: export then import', () => {
  it.each([
    ['created', created()],
    ['GPX', gpx()],
  ])('gives the same track (1 m) and length (10 m): %s', (_label, route) => {
    const before = exportTrackOf(route);
    const { text } = buildRouteGpx(route, null);
    const back = readGpx(text);
    if (!back.ok) throw new Error(back.reason);
    expect(back.name).toBe(route.name);
    expect(back.track).toHaveLength(before.length);
    back.track.forEach(([lon, lat], i) => {
      expect(trackLengthM([[lon, lat], before[i]])).toBeLessThan(1);
    });
    expect(
      Math.abs(trackLengthM(back.track) - trackLengthM(before)),
    ).toBeLessThan(10);
  });
});
