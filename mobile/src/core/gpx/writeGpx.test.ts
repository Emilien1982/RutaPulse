import { escapeXml, writeGpx } from './writeGpx';

// No @types/node in the project: node:fs is loaded untyped, like the native
// module in routing/fixtures.test.ts. Jest runs from mobile/.
const fs = jest.requireActual('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
};
const reference = fs.readFileSync(
  'src/core/gpx/fixtures/export-reference.gpx',
  'utf8',
);

describe('writeGpx', () => {
  it('writes exactly the reference file, validated against the GPX 1.1 schema', () => {
    // The reference was checked once with `xmllint --noout --schema gpx.xsd`.
    const text = writeGpx({
      name: 'Boucle du Bois de la Côte & <Haye>',
      track: [
        [6.1844, 48.6921],
        [6.184912, 48.69235],
        [6.1855, 48.693],
        [180, 48.6938],
      ],
      elevations: [212, null, 214.46, undefined],
    });
    expect(text).toBe(reference);
  });

  it('writes 6 decimals, no <ele> without altitude, no BOM, LF only', () => {
    const text = writeGpx({
      name: 'A',
      track: [
        [-0.0000001, 1.5],
        [2, -3],
      ],
    });
    expect(text).toContain('<trkpt lat="1.500000" lon="0.000000"/>');
    expect(text).toContain('<trkpt lat="-3.000000" lon="2.000000"/>');
    expect(text).not.toContain('<ele>');
    expect(text).not.toContain('\r');
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('skips a non finite altitude and keeps tenths', () => {
    const text = writeGpx({
      name: 'A',
      track: [
        [1, 1],
        [2, 2],
        [3, 3],
      ],
      elevations: [Number.NaN, 10.04, -0.04],
    });
    expect(text).toContain('<trkpt lat="1.000000" lon="1.000000"/>');
    expect(text).toContain('<ele>10</ele>');
    expect(text).toContain('<ele>0</ele>');
  });
});

describe('escapeXml', () => {
  it('escapes the 5 special characters', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('keeps accents, emoji and line breaks', () => {
    expect(escapeXml('Côte 🚵\n\t')).toBe('Côte 🚵\n\t');
  });

  it('drops forbidden characters and lone surrogate halves', () => {
    expect(escapeXml('a\u0000b\u0008c\u001Fd￾e￿f')).toBe('abcdef');
    expect(escapeXml('x\uD83Dy\uDE00z')).toBe('xyz');
  });
});
