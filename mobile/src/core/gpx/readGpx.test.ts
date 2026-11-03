import {
  MAX_ELEVATION_M,
  MAX_GPX_CHARS,
  MIN_ELEVATION_M,
  readGpx,
} from './readGpx';

const NS = 'xmlns="http://www.topografix.com/GPX/1/1"';
const gpx = (body: string, attrs = `version="1.1" ${NS}`) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<gpx ${attrs}>${body}</gpx>`;
const pt = (lat: string, lon: string, inner = '', tag = 'trkpt') =>
  `<${tag} lat="${lat}" lon="${lon}">${inner}</${tag}>`;
const trk = (...segments: string[][]) =>
  `<trk>${segments.map((s) => `<trkseg>${s.join('')}</trkseg>`).join('')}</trk>`;

function ok(text: string) {
  const result = readGpx(text);
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result;
}

describe('readGpx refusals', () => {
  it.each([
    ['empty', ''],
    ['only spaces', ' \n\t '],
    ['only a BOM', '﻿'],
  ])('%s -> empty', (_l, text) => {
    expect(readGpx(text)).toEqual({ ok: false, reason: 'empty' });
  });

  it('too many characters -> tooBig', () => {
    expect(readGpx(' '.repeat(MAX_GPX_CHARS + 1))).toEqual({
      ok: false,
      reason: 'tooBig',
    });
  });

  it.each([
    ['plain text', 'hello'],
    ['malformed XML', '<gpx><trk><trkseg></trk></gpx>'],
    ['truncated', gpx(trk([pt('1', '1')])).slice(0, 80)],
    ['another XML format', '<kml><Placemark/></kml>'],
    ['binary junk', '\u0000\u0001PK\u0003\u0004'],
  ])('%s -> unreadable', (_l, text) => {
    expect(readGpx(text)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('DOCTYPE with an external entity -> unreadable, no network call', () => {
    const fetchMock = jest.fn();
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const text = `<?xml version="1.0"?>
<!DOCTYPE gpx [<!ENTITY xxe SYSTEM "http://evil.example/secret">]>
<gpx ${NS}><metadata><name>&xxe;</name></metadata>${trk([pt('1', '1'), pt('2', '2')])}</gpx>`;
      expect(readGpx(text)).toEqual({ ok: false, reason: 'unreadable' });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });

  it('billion laughs -> unreadable, fast', () => {
    const entities = Array.from(
      { length: 9 },
      (_v, i) => `<!ENTITY lol${i + 1} "${`&lol${i};`.repeat(10)}">`,
    ).join('');
    const text = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol0 "lol">${entities}]>
<gpx ${NS}><metadata><name>&lol9;</name></metadata></gpx>`;
    const start = Date.now();
    expect(readGpx(text)).toEqual({ ok: false, reason: 'unreadable' });
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('an ENTITY alone, even in a comment, is refused', () => {
    const text = gpx(
      `<!-- <!ENTITY a "b"> -->${trk([pt('1', '1'), pt('2', '2')])}`,
    );
    expect(readGpx(text)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it.each([
    ['no point', gpx('<metadata><name>x</name></metadata>')],
    ['empty trkseg', gpx(trk([]))],
    ['one point', gpx(trk([pt('48', '6')]))],
    ['one point twice', gpx(trk([pt('48', '6'), pt('48.0000001', '6')]))],
    ['one route point', gpx(`<rte>${pt('48', '6', '', 'rtept')}</rte>`)],
  ])('%s -> noTrack', (_l, text) => {
    expect(readGpx(text)).toEqual({ ok: false, reason: 'noTrack' });
  });

  it.each([
    ['latitude 91', '91', '6'],
    ['latitude -90.5', '-90.5', '6'],
    ['longitude 181', '48', '181'],
    ['not a number', 'abc', '6'],
    ['exponent', '4.8e1', '6'],
    ['NaN', 'NaN', '6'],
    ['Infinity', '48', 'Infinity'],
    ['empty', '', '6'],
    ['comma decimal', '48,5', '6'],
  ])(
    'skips a point with %s, leaving noTrack if too few remain',
    (_l, lat, lon) => {
      const text = gpx(trk([pt(lat, lon), pt('48', '6')]));
      expect(readGpx(text)).toEqual({ ok: false, reason: 'noTrack' });
    },
  );

  it('skips a point without lat or lon', () => {
    const text = gpx(trk([`<trkpt lat="48"/>`, pt('48', '6'), pt('49', '7')]));
    expect(ok(text).track).toEqual([
      [6, 48],
      [7, 49],
    ]);
  });
});

describe('readGpx tracks', () => {
  it('reads a simple track with altitudes and a name', () => {
    const result = ok(
      gpx(
        `<metadata><name>Ma sortie</name></metadata>${trk([
          pt('48.5', '6.25', '<ele>212.5</ele>'),
          pt('48.51', '6.26'),
        ])}`,
      ),
    );
    expect(result).toEqual({
      ok: true,
      name: 'Ma sortie',
      track: [
        [6.25, 48.5],
        [6.26, 48.51],
      ],
      elevations: [212.5, null],
    });
  });

  it('glues several trk and segments in file order', () => {
    const result = ok(
      gpx(
        trk([pt('1', '1'), pt('2', '2')], [pt('3', '3'), pt('4', '4')]) +
          trk([pt('5', '5')]),
      ),
    );
    expect(result.track).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ]);
  });

  it('reads a route alone', () => {
    const result = ok(
      gpx(
        `<rte><name>Route</name>${pt('1', '1', '<ele>5</ele>', 'rtept')}${pt('2', '2', '', 'rtept')}</rte><rte>${pt('3', '3', '', 'rtept')}</rte>`,
      ),
    );
    expect(result.track).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
    expect(result.elevations).toEqual([5, null, null]);
    expect(result.name).toBe('Route');
  });

  it('keeps the track alone when the file has a track and a route', () => {
    const result = ok(
      gpx(
        `<rte>${pt('9', '9', '', 'rtept')}${pt('8', '8', '', 'rtept')}</rte>${trk([pt('1', '1'), pt('2', '2')])}`,
      ),
    );
    expect(result.track).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('works without altitude', () => {
    expect(ok(gpx(trk([pt('1', '1'), pt('2', '2')]))).elevations).toEqual([
      null,
      null,
    ]);
  });

  it('ignores a bad <ele> and wpt, time and unknown elements', () => {
    const result = ok(
      gpx(
        `<wpt lat="10" lon="10"><name>Café</name><ele>9</ele></wpt>${trk([
          pt(
            '1',
            '1',
            '<ele>high</ele><time>2026-01-01T00:00:00Z</time><foo>bar</foo>',
          ),
          pt('2', '2', '<ele>1e3</ele>'),
        ])}`,
      ),
    );
    expect(result.track).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(result.elevations).toEqual([null, null]);
    expect(result.name).toBe('');
  });

  it('reads a Garmin file with extensions and namespace prefixes', () => {
    const text = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" creator="Garmin Connect">
  <gpx:metadata><gpx:name>Sortie Garmin</gpx:name><gpx:link href="https://x.example"><gpx:text>x</gpx:text></gpx:link></gpx:metadata>
  <gpx:trk><gpx:name>Autre nom</gpx:name>
    <gpx:extensions><gpxx:TrackExtension xmlns:gpxx="urn:x"><gpxx:name>NON</gpxx:name></gpxx:TrackExtension></gpx:extensions>
    <gpx:trkseg>
      <gpx:trkpt lat="48.1" lon="6.1"><gpx:ele>250</gpx:ele><gpx:time>2026-01-01T00:00:00Z</gpx:time>
        <gpx:extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></gpx:extensions>
      </gpx:trkpt>
      <gpx:trkpt lat="48.2" lon="6.2"><gpx:ele>260</gpx:ele></gpx:trkpt>
    </gpx:trkseg>
  </gpx:trk>
</gpx:gpx>`;
    const result = ok(text);
    expect(result.name).toBe('Sortie Garmin');
    expect(result.track).toEqual([
      [6.1, 48.1],
      [6.2, 48.2],
    ]);
    expect(result.elevations).toEqual([250, 260]);
  });

  it('reads GPX 1.0 (name under gpx), single quotes, comments, CDATA', () => {
    const text = `﻿<?xml version='1.0'?>
<gpx version='1.0' creator='old' xmlns='http://www.topografix.com/GPX/1/0'>
  <!-- a comment with <trkpt lat="1" lon="1"/> inside -->
  <name><![CDATA[Vieille <sortie>]]></name>
  <trk><trkseg><trkpt lat='1' lon='1'/><trkpt lat='2' lon='2'/></trkseg></trk>
</gpx>`;
    const result = ok(text);
    expect(result.name).toBe('Vieille <sortie>');
    expect(result.track).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('accepts a UTF-8 BOM', () => {
    expect(ok('﻿' + gpx(trk([pt('1', '1'), pt('2', '2')]))).track).toHaveLength(
      2,
    );
  });

  it('keeps accents and decodes &amp; in the name', () => {
    const result = ok(
      gpx(
        `<metadata><name>Côte &amp; Forêt &#233;t&#xE9; &lt;3</name></metadata>${trk([pt('1', '1'), pt('2', '2')])}`,
      ),
    );
    expect(result.name).toBe('Côte & Forêt été <3');
  });

  it('chooses the name: metadata, gpx, trk, rte', () => {
    const points = trk([pt('1', '1'), pt('2', '2')]).replace(
      '<trk>',
      '<trk><name>T</name>',
    );
    expect(ok(gpx(`<rte><name>R</name></rte>${points}`)).name).toBe('T');
    expect(
      ok(gpx(`<rte><name>R</name></rte>${trk([pt('1', '1'), pt('2', '2')])}`))
        .name,
    ).toBe('R');
    expect(ok(gpx(`<name>G</name>${points}`)).name).toBe('G');
    expect(
      ok(gpx(`<metadata><name>M</name></metadata><name>G</name>${points}`))
        .name,
    ).toBe('M');
  });

  it('normalizes spaces and cuts the name to 60 characters', () => {
    const long = 'é'.repeat(70);
    const result = ok(
      gpx(
        `<name>  a \n  b\t</name><metadata><name>${long}</name></metadata>${trk([pt('1', '1'), pt('2', '2')])}`,
      ),
    );
    expect(Array.from(result.name)).toHaveLength(60);
    expect(
      ok(gpx(`<name>  a \n  b\t</name>${trk([pt('1', '1'), pt('2', '2')])}`))
        .name,
    ).toBe('a b');
  });

  it('rounds to 6 decimals and merges identical consecutive points', () => {
    const result = ok(
      gpx(
        trk([
          pt('48.12345649', '6.1234565'),
          pt('48.1234561', '6.1234565'),
          pt('+48.2', '.5'),
          pt('-0.0000001', '-0'),
        ]),
      ),
    );
    expect(result.track).toEqual([
      [6.123457, 48.123456],
      [0.5, 48.2],
      [0, 0],
    ]);
    expect(Object.is(result.track[2][0], -0)).toBe(false);
  });

  it('accepts the exact bounds', () => {
    expect(ok(gpx(trk([pt('-90', '-180'), pt('90', '180')]))).track).toEqual([
      [-180, -90],
      [180, 90],
    ]);
  });
});

describe('readGpx speed', () => {
  it('reads 10 000 points with altitude, time and extensions quickly', () => {
    const points: string[] = [];
    for (let i = 0; i < 10000; i++) {
      points.push(
        pt(
          (48 + i * 1e-5).toFixed(6),
          (6 + i * 1e-5).toFixed(6),
          `<ele>${200 + (i % 50)}</ele><time>2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z</time><extensions><hr>140</hr></extensions>`,
        ),
      );
    }
    const text = gpx(trk(points));
    const start = Date.now();
    const result = ok(text);
    const elapsed = Date.now() - start;
    expect(result.track).toHaveLength(10000);
    // Indicative only: Jest runs on Node, not on Hermes (ADR 0019, check 4).
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('readGpx on hostile numbers', () => {
  const digits = '1'.repeat(1_000_000) + 'x';

  it.each([
    ['lat', gpx(trk([pt(digits, '6'), pt('48', '6')]))],
    ['lon', gpx(trk([pt('48', digits), pt('49', '6')]))],
    ['ele', gpx(trk([pt('48', '6', `<ele>${digits}</ele>`), pt('49', '6')]))],
  ])('a huge non numeric %s is handled in linear time', (_l, text) => {
    const start = Date.now();
    const result = readGpx(text);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
    if (_l === 'ele') expect(result).toMatchObject({ ok: true });
    else expect(result).toEqual({ ok: false, reason: 'noTrack' });
  });

  it('refuses a document nested too deep', () => {
    const text = gpx('<a>'.repeat(100) + '</a>'.repeat(100));
    expect(readGpx(text)).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('readGpx altitude range', () => {
  it.each([
    [String(MIN_ELEVATION_M), MIN_ELEVATION_M],
    [String(MAX_ELEVATION_M), MAX_ELEVATION_M],
    ['-1000.1', null],
    ['10000.1', null],
    ['1' + '0'.repeat(21), null],
  ])('altitude %s is read as %s', (raw, expected) => {
    const result = readGpx(
      gpx(trk([pt('48', '6', `<ele>${raw}</ele>`), pt('49', '6')])),
    );
    expect(result).toMatchObject({ ok: true, elevations: [expected, null] });
  });
});
