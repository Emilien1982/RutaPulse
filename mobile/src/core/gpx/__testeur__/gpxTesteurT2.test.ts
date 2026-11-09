// Tests written by the tester from the spec (docs/phases/p06-..., C9-C13,
// ADR 0019 sections 7-9), not from the code. Sample files: ./exemples/.
// Set XSD_OUT_DIR to also write the files produced by writeGpx there, so that
// `xmllint --noout --schema gpx.xsd` can check them from the shell.

import { decodePolyline6 } from '../../routing/routeResponse';
import { MAX_GPX_CHARS, readGpx } from '../readGpx';
import { trackLengthM } from '../trackLengthM';
import { writeGpx } from '../writeGpx';

// The project has no @types/node: minimal typings for the 3 calls we need.
declare const __dirname: string;
declare function require(name: string): unknown;
type Fs = {
  readFileSync(file: string, encoding: 'utf8'): string;
  writeFileSync(file: string, data: string): void;
  mkdirSync(dir: string, options: { recursive: boolean }): void;
};
type Path = {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
};
declare const process: { env: Record<string, string | undefined> };
const fs = require('fs') as Fs;
const path = require('path') as Path;

const EX = path.join(__dirname, 'exemples');
const sample = (name: string) => fs.readFileSync(path.join(EX, name), 'utf8');
const NS = 'xmlns="http://www.topografix.com/GPX/1/1"';
const wrap = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><gpx ${NS} version="1.1" creator="t">${body}</gpx>`;
const twoPts = '<trkpt lat="1" lon="2"/><trkpt lat="3" lon="4"/>';
const trkOf = (inner: string) => `<trk><trkseg>${inner}</trkseg></trk>`;

function ok(text: string) {
  const r = readGpx(text);
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}
const refused = (text: string) => {
  const r = readGpx(text);
  return r.ok ? 'ok' : r.reason;
};

describe('sample files from common apps', () => {
  it('Strava: extensions, times, prefixed extension elements', () => {
    const r = ok(sample('strava.gpx'));
    expect(r.name).toBe('Sortie VTT du matin');
    expect(r.track).toEqual([
      [6.1844, 48.6921],
      [6.184912, 48.69235],
      [6.1853, 48.6926],
    ]);
    expect(r.elevations).toEqual([212.4, 213, 214.6]);
  });

  it('Garmin Connect: BOM, Windows line ends, wpt ignored, name on 2 lines', () => {
    const text = sample('garmin-bom-crlf.gpx');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('\r\n');
    const r = ok(text);
    expect(r.name).toBe('Garmin Boucle');
    expect(r.track).toEqual([
      [6.1, 48.1],
      [6.101, 48.101],
      [6.102, 48.102],
    ]);
    expect(r.elevations).toEqual([300.2, 301.2, 302.2]);
  });

  it('Komoot: metadata name with an entity, single quoted XML declaration', () => {
    const r = ok(sample('komoot.gpx'));
    expect(r.name).toBe('Tour du Haut-Barr & Saverne');
    expect(r.track).toHaveLength(3);
    expect(r.elevations).toEqual([200, 205, 210]);
  });

  it('OsmAnd: mixed points with and without altitude, wpt ignored', () => {
    const r = ok(sample('osmand.gpx'));
    expect(r.name).toBe('OsmAnd piste');
    expect(r.track).toHaveLength(3);
    expect(r.elevations).toEqual([null, 800, null]);
  });

  it('Openrunner: route only (rte/rtept)', () => {
    const r = ok(sample('openrunner-route.gpx'));
    expect(r.name).toBe('Openrunner parcours 123');
    expect(r.track).toEqual([
      [4, 46],
      [4.001, 46.001],
      [4.002, 46.002],
    ]);
    expect(r.elevations).toEqual([100, 101, null]);
  });

  it('GPX 1.0: name of the gpx root wins over the trk name', () => {
    const r = ok(sample('gpx10.gpx'));
    expect(r.name).toBe('Ancien format 1.0');
    expect(r.track).toEqual([
      [3, 44],
      [3.001, 44.001],
    ]);
    expect(r.elevations).toEqual([50.5, 51.5]);
  });

  it('several segments and several traces are joined in file order', () => {
    const r = ok(sample('multi-segments-multi-traces.gpx'));
    expect(r.name).toBe('Première');
    expect(r.track.map((p) => p[1])).toEqual([
      10, 10.1, 10.2, 10.3, 10.4, 10.5,
    ]);
  });

  it('a file with trk and rte gives the trace only', () => {
    const r = ok(sample('trace-et-route.gpx'));
    expect(r.name).toBe('trace');
    expect(r.track).toEqual([
      [20, 20],
      [21, 21],
    ]);
  });

  it('namespace prefix, comments, CDATA name, single quotes', () => {
    const r = ok(sample('prefixe-commentaires-cdata.gpx'));
    expect(r.name).toBe('Col <du> "Rouge" & co');
    expect(r.track).toEqual([
      [7.5, 47.5],
      [7.6, 47.6],
    ]);
    expect(r.elevations).toEqual([10, 12.5]);
  });

  it('bad points are skipped, valid forms kept, duplicates merged', () => {
    const r = ok(sample('points-faux-et-doublons.gpx'));
    // lon,lat order. 45.0000001 rounds to 45 -> merged with the first point.
    // ele "1e3" and "abc" -> null. " 12 " -> 12.
    expect(r.track).toEqual([
      [5, 45],
      [5.1, 45.1],
      [5.2, 45.2],
      [-5.3, 45.3],
      [5, 0.5],
    ]);
    expect(r.elevations).toEqual([null, null, null, 12, null]);
  });
});

describe('refusals', () => {
  it.each([
    ['empty string', '', 'empty'],
    ['spaces only', '   \n\t\r\n ', 'empty'],
    ['binary', '\u0000\u0001\u0002PK\u0003\u0004��', 'unreadable'],
    ['truncated XML', sample('strava.gpx').slice(0, 700), 'unreadable'],
    [
      'truncated in a tag',
      sample('komoot.gpx').slice(0, 900) + '<trkpt lat="1',
      'unreadable',
    ],
    ['not GPX', '<kml><Document/></kml>', 'unreadable'],
    ['mismatched tags', wrap('<trk></trkseg>'), 'unreadable'],
    ['text before root', 'bonjour <gpx/>', 'unreadable'],
    [
      'gpx without track',
      wrap('<metadata><name>x</name></metadata>'),
      'noTrack',
    ],
    ['one point only', wrap(trkOf('<trkpt lat="1" lon="2"/>')), 'noTrack'],
    [
      'two identical points',
      wrap(trkOf('<trkpt lat="1" lon="2"/><trkpt lat="1" lon="2"/>')),
      'noTrack',
    ],
    [
      'only wpt',
      wrap('<wpt lat="1" lon="2"/><wpt lat="3" lon="4"/>'),
      'noTrack',
    ],
    [
      'all points out of bounds',
      wrap(trkOf('<trkpt lat="91" lon="0"/><trkpt lat="0" lon="181"/>')),
      'noTrack',
    ],
    ['one rte point', wrap('<rte><rtept lat="1" lon="2"/></rte>'), 'noTrack'],
  ])('%s -> %s', (_l, text, reason) => {
    expect(refused(text)).toBe(reason);
  });

  it('bounds are inclusive: -90/90 and -180/180 are kept', () => {
    const r = ok(
      wrap(trkOf('<trkpt lat="-90" lon="-180"/><trkpt lat="90" lon="180"/>')),
    );
    expect(r.track).toEqual([
      [-180, -90],
      [180, 90],
    ]);
  });

  it('more than 20 000 000 characters -> tooBig, fast', () => {
    const t0 = Date.now();
    expect(refused(' '.repeat(MAX_GPX_CHARS + 1))).toBe('tooBig');
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('exactly 20 000 000 characters is not tooBig', () => {
    const base = wrap(trkOf(twoPts));
    const text = base + ' '.repeat(20_000_000 - base.length);
    expect(text.length).toBe(20_000_000);
    expect(refused(text)).toBe('ok');
  });
});

describe('XML attacks (ADR 0019 section 9)', () => {
  const doctype = (inner: string) =>
    `<?xml version="1.0"?>\n${inner}\n<gpx ${NS} version="1.1"><trk><name>&xxe;</name><trkseg>${twoPts}</trkseg></trk></gpx>`;
  const fetchSpy = jest.fn();
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    fetchSpy.mockClear();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  it.each([
    [
      'SYSTEM file',
      '<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>',
    ],
    [
      'SYSTEM http',
      '<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "http://127.0.0.1:9/x"> ]>',
    ],
    [
      'DOCTYPE external DTD',
      '<!DOCTYPE gpx SYSTEM "http://127.0.0.1:9/gpx.dtd">',
    ],
    [
      'billion laughs',
      '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">]>',
    ],
    [
      'parameter entity',
      '<!DOCTYPE foo [ <!ENTITY % pe SYSTEM "http://127.0.0.1:9/e.dtd"> %pe; ]>',
    ],
    ['lower case doctype', '<!doctype foo>'],
    ['ENTITY alone, no DOCTYPE', '<!ENTITY a "b">'],
  ])('%s -> unreadable, fetch never called', (_l, decl) => {
    expect(refused(doctype(decl))).toBe('unreadable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('DOCTYPE hidden after a BOM or in the middle is refused too', () => {
    expect(refused('﻿' + doctype('<!DOCTYPE a>'))).toBe('unreadable');
    expect(
      refused(
        wrap(`<metadata><name>x</name></metadata>${trkOf(twoPts)}<!DOCTYPE a>`),
      ),
    ).toBe('unreadable');
  });

  it('an undeclared &xxe; stays written as is; no file is read', () => {
    const r = ok(wrap(`<name>a &xxe; b</name>${trkOf(twoPts)}`));
    expect(r.name).toBe('a &xxe; b');
  });

  it('numeric references and the 5 entities are decoded', () => {
    const r = ok(
      wrap(
        `<name>&#233;&#xE9; &lt;&amp;&gt;&quot;&apos;</name>${trkOf(twoPts)}`,
      ),
    );
    expect(r.name).toBe('éé <&>"\'');
  });

  it('very deep nesting -> unreadable, no crash, fast', () => {
    const t0 = Date.now();
    const deep = `<?xml version="1.0"?><gpx ${NS}>` + '<a>'.repeat(200_000);
    expect(refused(deep)).toBe('unreadable');
    const deepClosed =
      `<gpx ${NS}>` + '<a>'.repeat(100_000) + '</a>'.repeat(100_000) + '</gpx>';
    expect(refused(deepClosed)).toBe('unreadable');
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('very long attribute / tag junk does not hang', () => {
    const t0 = Date.now();
    refused(wrap(`<trk><trkseg><trkpt ${'a="1" '.repeat(100_000)}`));
    refused(wrap(`<trkpt lat="${'1'.repeat(1_000_000)}`));
    refused(wrap('<' + 'a'.repeat(1_000_000)));
    refused(wrap('<trkpt ' + ' '.repeat(1_000_000) + 'x'));
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe('hostile numbers', () => {
  const one = (lat: string, lon: string, ele?: string) =>
    wrap(
      trkOf(
        `<trkpt lat="1" lon="1"/><trkpt lat="${lat}" lon="${lon}">${
          ele === undefined ? '' : `<ele>${ele}</ele>`
        }</trkpt><trkpt lat="3" lon="3"/>`,
      ),
    );

  it('1 000 000 digits followed by x: refused point, fast (no backtracking)', () => {
    const big = '1'.repeat(1_000_000) + 'x';
    const t0 = Date.now();
    const r = ok(one(big, '5'));
    const r2 = ok(one('5', big));
    const r3 = ok(one('5', '5', big));
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r.track).toHaveLength(2);
    expect(r2.track).toHaveLength(2);
    expect(r3.elevations).toEqual([null, null, null]);
  });

  it('1 000 000 digits with dot then x, and with spaces', () => {
    const t0 = Date.now();
    ok(one('1.' + '1'.repeat(1_000_000) + 'x', '5'));
    ok(one('.' + '0'.repeat(1_000_000) + 'x', '5'));
    ok(one('5', '5', '1'.repeat(1_000_000) + '.x'));
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('1 000 000 valid digits (value overflows): point skipped / ele null', () => {
    const big = '1'.repeat(1_000_000);
    expect(ok(one(big, '5')).track).toHaveLength(2);
    expect(ok(one('5', '5', big)).elevations).toEqual([null, null, null]);
  });

  it.each([
    '1e1',
    '1E2',
    '5e-1',
    'NaN',
    'Infinity',
    '-Infinity',
    '45,5',
    '0x10',
    '--5',
    '+-5',
    '4 5',
    '.',
    '+',
    '-',
    '',
  ])('lat %j is not a decimal -> point skipped', (v) => {
    expect(ok(one(v, '5')).track).toHaveLength(2);
  });

  it.each(['1e3', 'NaN', 'Infinity', '1,5', 'abc', ''])(
    'ele %j -> null, point kept',
    (v) => {
      const r = ok(one('5', '5', v));
      expect(r.track).toHaveLength(3);
      expect(r.elevations[1]).toBeNull();
    },
  );

  it('ele followed by 22 digits is read without crash', () => {
    const r = ok(one('5', '5', '1234567890123456789012'));
    expect(r.track).toHaveLength(3);
    const e = r.elevations[1];
    expect(e === null || Number.isFinite(e)).toBe(true);
  });

  // DEFECT (T2): writeGpx writes <ele>1e+21</ele> from 1e21 m, invalid xsd:decimal.
  it('a huge altitude read then written gives an XSD-valid decimal (no exponent)', () => {
    const r = ok(one('5', '5', '1234567890123456789012'));
    const out = writeGpx({
      name: 'x',
      track: r.track,
      elevations: r.elevations,
    });
    expect(out).not.toMatch(/<ele>[^<]*[eE][^<]*<\/ele>/);
    expect(out).not.toMatch(/<ele>(NaN|Infinity)/);
  });

  // DEFECT (T2): writeGpx writes <ele>1e+21</ele> from 1e21 m, invalid xsd:decimal.
  it('writeGpx never writes an exponent, for any finite altitude', () => {
    for (const e of [1e21, -1e21, 1.5e300, 1e-7, 123456789012345678901234]) {
      const out = writeGpx({
        name: 'x',
        track: [
          [1, 1],
          [2, 2],
        ],
        elevations: [e, null],
      });
      expect(out).not.toMatch(/<ele>[^<]*[eE][^<]*<\/ele>/);
    }
  });

  it('boundary values are rounded to 6 decimals', () => {
    const r = ok(one('45.1234565', '5.1234564'));
    expect(r.track[1]).toEqual([5.123456, 45.123457]);
  });
});

describe('performance (C13)', () => {
  function bigFile(n: number) {
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const lat = (45 + i * 1e-5).toFixed(6);
      const lon = (5 + i * 1e-5).toFixed(6);
      lines.push(
        `<trkpt lat="${lat}" lon="${lon}"><ele>${(300 + (i % 50)).toFixed(1)}</ele><time>2026-10-12T07:31:02Z</time></trkpt>`,
      );
    }
    return wrap(trkOf(lines.join('\n')));
  }
  it('10 000 points in well under 3 s; 150 000 points in under 10 s', () => {
    const t = bigFile(10_000);
    const t0 = Date.now();
    expect(ok(t).track).toHaveLength(10_000);
    const d1 = Date.now() - t0;
    const big = bigFile(150_000);
    const t1 = Date.now();
    expect(ok(big).track).toHaveLength(150_000);
    const d2 = Date.now() - t1;
    console.log(`10k points: ${d1} ms, 150k points: ${d2} ms`);
    expect(d1).toBeLessThan(3000);
    expect(d2).toBeLessThan(10_000);
  });
});

describe('write then read (C11)', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const refs = (n: string) => {
    const f = path.join(
      root,
      'docs/phases/preuves/p05/t7/references/passage-1/banc-p05',
      `refs-${n}.json`,
    );
    const d = JSON.parse(fs.readFileSync(f, 'utf8')) as {
      troncons: {
        altitudes: { brut: { request: { encoded_polyline: string } } };
      }[];
    };
    const pts: [number, number][] = [];
    for (const t of d.troncons) {
      const s = decodePolyline6(t.altitudes.brut.request.encoded_polyline);
      const skip =
        pts.length > 0 &&
        pts[pts.length - 1][0] === s[0][0] &&
        pts[pts.length - 1][1] === s[0][1];
      pts.push(...(skip ? s.slice(1) : s));
    }
    return pts;
  };
  const ios = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../routing/fixtures/ios-success.json'),
      'utf8',
    ),
  ) as { trip: { legs: { shape: string }[] } };

  const dist1 = (a: number[], b: number[]) => trackLengthM([a, b]);
  const cases: [string, [number, number][], number][] = [
    ['R4 (40 km)', refs('R4'), 40000],
    ['R2 (35 km)', refs('R2'), 34000],
    ['R1 (19 km)', refs('R1'), 18000],
    ['ios-success shape', decodePolyline6(ios.trip.legs[0].shape), 0],
    [
      'south-west hemisphere, negative lon/lat',
      Array.from({ length: 300 }, (_v, i): [number, number] => [
        -70.123456 - i * 0.00037,
        -33.654321 + i * 0.00041,
      ]),
      0,
    ],
    [
      'near the pole and the antimeridian',
      [
        [179.999999, 89.5],
        [-179.5, 89.6],
        [178.25, 89.7],
        [-0.000001, -89.9],
      ],
      0,
    ],
  ];
  const lines: string[] = [];

  it.each(cases)('%s', (label, track, minLen) => {
    const elevations = track.map((_p, i) => (i % 4 === 0 ? null : 100 + i / 3));
    const back = ok(writeGpx({ name: label, track, elevations }));
    // expected: input rounded to 6 decimals, consecutive duplicates merged
    const expected: [number, number][] = [];
    for (const p of track) {
      const q: [number, number] = [
        Number(p[0].toFixed(6)) + 0,
        Number(p[1].toFixed(6)) + 0,
      ];
      const l = expected[expected.length - 1];
      if (!l || l[0] !== q[0] || l[1] !== q[1]) expected.push(q);
    }
    expect(back.track).toHaveLength(expected.length);
    let maxM = 0;
    back.track.forEach((p, i) => {
      // 180 is written -180: same place on the Earth
      const e: [number, number] = [
        expected[i][0] === 180 ? -180 : expected[i][0],
        expected[i][1],
      ];
      const lonDiff = Math.min(
        Math.abs(p[0] - e[0]),
        360 - Math.abs(p[0] - e[0]),
      );
      const m = lonDiff === 0 && p[1] === e[1] ? 0 : dist1(p, e);
      maxM = Math.max(maxM, m);
    });
    const lenIn = trackLengthM(track);
    const lenOut = trackLengthM(back.track);
    lines.push(
      `${label};points=${track.length}->${back.track.length};max_point_gap_m=${maxM.toFixed(3)};len_in_m=${lenIn.toFixed(1)};len_out_m=${lenOut.toFixed(1)};diff_m=${(lenOut - lenIn).toFixed(3)}`,
    );
    console.log(lines[lines.length - 1]);
    expect(maxM).toBeLessThanOrEqual(1);
    expect(Math.abs(lenOut - lenIn)).toBeLessThanOrEqual(10);
    if (minLen) expect(lenIn).toBeGreaterThan(minLen);
    expect(back.name).toBe(label);
    // altitudes: rounded to a tenth, null where unknown
    expect(back.elevations).toHaveLength(back.track.length);
  });

  it('a 3-point known distance matches an external value', () => {
    // Source: great-circle distance Paris (2.3522E, 48.8566N) -> Lyon
    // (4.8357E, 45.7640N) is about 391.5 km on a 6371 km sphere (haversine,
    // movable-type.co.uk calculator). On Valhalla radius (6378.16 km) it is
    // 0.112 % longer: about 391.9 km.
    const km =
      trackLengthM([
        [2.3522, 48.8566],
        [4.8357, 45.764],
      ]) / 1000;
    expect(km).toBeGreaterThan(391.4);
    expect(km).toBeLessThan(392.4);
  });
});

describe('files for xmllint', () => {
  const out = process.env.XSD_OUT_DIR;
  const tr: [number, number][] = [
    [6.1844, 48.6921],
    [6.184912, 48.69235],
    [6.1853, 48.6926],
  ];
  const cases: [
    string,
    string,
    [number, number][],
    (number | null)[] | undefined,
  ][] = [
    ['strava', 'strava.gpx', [], undefined],
    ['garmin', 'garmin-bom-crlf.gpx', [], undefined],
    ['komoot', 'komoot.gpx', [], undefined],
    ['osmand-sans-altitude-partielle', 'osmand.gpx', [], undefined],
    ['openrunner-route', 'openrunner-route.gpx', [], undefined],
    ['gpx10', 'gpx10.gpx', [], undefined],
    ['cdata-nom', 'prefixe-commentaires-cdata.gpx', [], undefined],
    ['multi-segments', 'multi-segments-multi-traces.gpx', [], undefined],
  ];
  it.each(cases)('writes %s', (label, file) => {
    const r = ok(sample(file));
    const text = writeGpx({
      name: r.name,
      track: r.track,
      elevations: r.elevations,
    });
    const back = ok(text);
    expect(back.track).toEqual(r.track);
    expect(back.name).toBe(r.name);
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, `${label}.gpx`), text);
    }
  });
  it.each([
    ['nom-esperluette', 'Côte & "Forêt" <1> \'x\' é 🚵'],
    ['nom-vide', ''],
    ['nom-controle', 'a\u0000b\u0007c\ud800d'],
    ['nom-long', 'x'.repeat(5000)],
  ])('writes a track with name %s, no altitude', (label, name) => {
    const text = writeGpx({ name, track: tr });
    expect(text).not.toContain('<ele>');
    expect(text.startsWith('<?xml')).toBe(true);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text).not.toContain('\r');
    ok(text);
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, `${label}.gpx`), text);
    }
  });
  it('writes extreme coordinates and altitudes', () => {
    const text = writeGpx({
      name: 'extrêmes',
      track: [
        [180, 90],
        [-180, -90],
        [0, 0],
        [-0.0000001, -0.0000001],
      ],
      elevations: [8848.86, -430, 0, -0.04],
    });
    ok(text);
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, 'extremes.gpx'), text);
    }
  });
});
