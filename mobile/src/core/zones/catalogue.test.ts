import realCatalogue from './fixtures/catalogueV3.json';
import { CatalogueError, parseCatalogue } from './catalogue';

// fixtures/catalogueV3.json is a copy of the published catalogue, read on
// 2026-10-24 from
// https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json
// The sizes below come from ADR 0013 (taken from that file).
describe('parseCatalogue with the real catalogue (Nancy v3)', () => {
  const catalogue = parseCatalogue(realCatalogue);

  it('reads one zone with 9 files and the published total', () => {
    expect(catalogue.zones).toHaveLength(1);
    const zone = catalogue.zones[0];
    expect(zone.id).toBe('nancy');
    expect(zone.version).toBe(3);
    expect(zone.files).toHaveLength(9);
    expect(zone.totalBytes).toBe(110_962_386);
  });

  it('keeps the nested path of the elevation files', () => {
    const paths = catalogue.zones[0].files.map((f) => f.path);
    expect(paths).toContain('elevation/N48/N48E005.hgt');
  });
});

function valid() {
  return structuredClone(realCatalogue) as Record<string, any>;
}

function expectInvalid(change: (c: Record<string, any>) => void) {
  const c = valid();
  change(c);
  expect(() => parseCatalogue(c)).toThrow(CatalogueError);
}

describe('parseCatalogue refuses an invalid catalogue', () => {
  it.each([
    ['a formatVersion other than 1', (c: any) => (c.formatVersion = 2)],
    ['a missing zones list', (c: any) => delete c.zones],
    ['a bad zone id', (c: any) => (c.zones[0].id = 'Nancy')],
    ['an empty name', (c: any) => (c.zones[0].name = '')],
    ['a version of 0', (c: any) => (c.zones[0].version = 0)],
    ['a latitude out of range', (c: any) => (c.zones[0].bbox.latMax = 91)],
    ['an inverted bbox', (c: any) => (c.zones[0].bbox.lonMin = 7)],
    ['a bad osmDate', (c: any) => (c.zones[0].osmDate = '2026-10-22')],
    ['no files', (c: any) => (c.zones[0].files = [])],
    ['a path with ..', (c: any) => (c.zones[0].files[0].path = '../x')],
    ['a path starting with /', (c: any) => (c.zones[0].files[0].path = '/x')],
    [
      'a hidden file name',
      (c: any) => (c.zones[0].files[0].path = '.ready.json'),
    ],
    [
      'a sha256 in capitals',
      (c: any) => (c.zones[0].files[0].sha256 = 'A'.repeat(64)),
    ],
    ['a short sha256', (c: any) => (c.zones[0].files[0].sha256 = 'ab')],
    ['an http url', (c: any) => (c.zones[0].files[0].url = 'http://x/y')],
    ['bytes of 0', (c: any) => (c.zones[0].files[0].bytes = 0)],
    ['a total that is not the sum', (c: any) => (c.zones[0].totalBytes += 1)],
  ])('%s', (_name, change) => expectInvalid(change));

  it('a value that is not an object', () => {
    expect(() => parseCatalogue('text')).toThrow(CatalogueError);
    expect(() => parseCatalogue(null)).toThrow(CatalogueError);
  });
});

describe('parseCatalogue leniency', () => {
  it('ignores unknown fields', () => {
    const c = valid();
    c.future = true;
    c.zones[0].future = 1;
    c.zones[0].files[0].future = 'x';
    expect(parseCatalogue(c).zones[0].id).toBe('nancy');
  });

  it('accepts an empty list of zones', () => {
    expect(parseCatalogue({ formatVersion: 1, zones: [] }).zones).toEqual([]);
  });
});
