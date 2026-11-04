import { gpxFileName } from './gpxFileName';
import { readGpx } from './readGpx';

describe('gpxFileName, end of the name', () => {
  it('drops the dots and spaces at the end before .gpx', () => {
    expect(gpxFileName('Itinéraire du 4 nov.')).toBe('Itinéraire du 4 nov.gpx');
    expect(gpxFileName('Tour . . ')).toBe('Tour.gpx');
    expect(gpxFileName('...')).toBe('itineraire.gpx');
  });
});

describe('readGpx, name made of control characters', () => {
  it('takes the next name when the first one is only control characters', () => {
    const result = readGpx(
      '<gpx version="1.1"><metadata><name>&#1;</name></metadata><trk><name>Tour</name><trkseg>' +
        '<trkpt lat="48.69" lon="6.18"/><trkpt lat="48.7" lon="6.19"/></trkseg></trk></gpx>',
    );
    expect(result.ok && result.name).toBe('Tour');
  });
});
