import { decodeEntities, readAttributes, scanXml, XmlError } from './xmlScan';

const none = { open: () => undefined, close: () => undefined };
const scan = (xml: string) => scanXml(xml, none, new Set());

describe('decodeEntities', () => {
  it('decodes the 5 predefined entities and numeric references', () => {
    expect(
      decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;'),
    ).toBe('a & b <c> "d" \'e\'');
    expect(decodeEntities('&#233;&#xE9;&#x1F6B5;')).toBe('éé🚵');
  });

  it('decodes once and leaves unknown entities alone', () => {
    expect(decodeEntities('&amp;lt;')).toBe('&lt;');
    expect(decodeEntities('&lol; &#0; &#xD800;')).toBe('&lol; &#0; &#xD800;');
  });
});

describe('readAttributes', () => {
  it('reads both quote styles and drops the prefix', () => {
    const attrs = readAttributes(
      ' lat="48.5" lon=\'6.1\' xsi:note = "a&amp;b"',
    );
    expect(attrs.get('lat')).toBe('48.5');
    expect(attrs.get('lon')).toBe('6.1');
    expect(attrs.get('note')).toBe('a&b');
  });
});

describe('scanXml', () => {
  it('gives the path of each element and the text of the wanted ones', () => {
    const events: string[] = [];
    scanXml(
      '<?xml version="1.0"?><!-- c --><gpx><a:name>x &amp; <![CDATA[<y>]]></a:name><e/></gpx>',
      {
        open: (path) => events.push(`open ${path.join('/')}`),
        close: (path, text) => events.push(`close ${path.join('/')} "${text}"`),
      },
      new Set(['name']),
    );
    expect(events).toEqual([
      'open gpx',
      'open gpx/name',
      'close gpx/name "x & <y>"',
      'open gpx/e',
      'close gpx/e ""',
      'close gpx ""',
    ]);
  });

  it('accepts a BOM and a ">" inside an attribute value', () => {
    expect(() => scan('﻿<gpx a="1>2"></gpx>')).not.toThrow();
  });

  it.each([
    ['no root', '<?xml version="1.0"?>'],
    ['wrong root', '<kml></kml>'],
    ['unclosed element', '<gpx><a></gpx>'],
    ['crossed tags', '<gpx><a><b></a></b></gpx>'],
    ['left open', '<gpx><a>'],
    ['second root', '<gpx></gpx><gpx></gpx>'],
    ['text outside', 'hello <gpx></gpx>'],
    ['bad tag', '<gpx><a b=c></a></gpx>'],
    ['unclosed comment', '<gpx><!-- </gpx>'],
    ['unclosed CDATA', '<gpx><![CDATA[ </gpx>'],
    ['DOCTYPE', '<!DOCTYPE gpx><gpx/>'],
    ['ENTITY in a comment', '<gpx><!-- <!ENTITY a "b"> --></gpx>'],
  ])('refuses %s', (_label, xml) => {
    expect(() => scan(xml)).toThrow(XmlError);
  });
});
