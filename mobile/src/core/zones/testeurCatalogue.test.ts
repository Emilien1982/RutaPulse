// Tester tests for C1 (read the catalogue), written from the spec and ADR 0013.
// External source: the real catalogue, fetched once on 2026-10-26 with
//   curl -sL https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json
// and saved in fixtures/catalogueReelTesteur.json.
import real from './fixtures/catalogueReelTesteur.json';
import { CatalogueError, parseCatalogue } from './catalogue';

const sha = 'a'.repeat(64);
const goodFile = {
  path: 'map.pmtiles',
  bytes: 10,
  sha256: sha,
  url: 'https://github.com/x/y/releases/download/zone-nancy-v3/map.pmtiles',
};
const goodZone = {
  id: 'nancy',
  name: 'Nancy',
  version: 3,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-10-22T20:21:33Z',
  totalBytes: 10,
  files: [goodFile],
};
const cat = (zone: unknown) => ({ formatVersion: 1, zones: [zone] });
const withZone = (patch: Record<string, unknown>) => ({
  ...goodZone,
  ...patch,
});

describe('C1 real catalogue', () => {
  it('reads name, total size and data date of Nancy v3', () => {
    const c = parseCatalogue(real);
    expect(c.zones).toHaveLength(1);
    const z = c.zones[0];
    expect(z.id).toBe('nancy');
    expect(z.name).toBe('Nancy');
    expect(z.version).toBe(3);
    expect(z.totalBytes).toBe(110962386);
    expect(z.osmDate).toBe('2026-10-22T20:21:33Z');
    expect(z.files).toHaveLength(9);
    expect(z.files.reduce((s, f) => s + f.bytes, 0)).toBe(110962386);
  });
});

describe('C1 limit cases', () => {
  it('accepts a minimal good catalogue', () => {
    expect(parseCatalogue(cat(goodZone)).zones[0].name).toBe('Nancy');
  });
  it('accepts an empty zone list', () => {
    expect(parseCatalogue({ formatVersion: 1, zones: [] }).zones).toEqual([]);
  });
  it('ignores unknown fields', () => {
    expect(
      parseCatalogue({ ...cat(withZone({ extra: 1 })), more: true }).zones,
    ).toHaveLength(1);
  });
  it.each([
    ['null', null],
    ['empty object', {}],
    ['array', []],
    ['string', 'x'],
    ['number', 3],
  ])('refuses %s', (_n, value) => {
    expect(() => parseCatalogue(value)).toThrow(CatalogueError);
  });
  it('refuses a wrong formatVersion or a missing zones list', () => {
    expect(() => parseCatalogue({ formatVersion: 2, zones: [] })).toThrow(
      CatalogueError,
    );
    expect(() => parseCatalogue({ zones: [] })).toThrow(CatalogueError);
    expect(() => parseCatalogue({ formatVersion: 1 })).toThrow(CatalogueError);
    expect(() => parseCatalogue({ formatVersion: 1, zones: {} })).toThrow(
      CatalogueError,
    );
  });
  it.each(['id', 'name', 'version', 'bbox', 'osmDate', 'totalBytes', 'files'])(
    'refuses a zone without %s',
    (field) => {
      const z: Record<string, unknown> = { ...goodZone };
      delete z[field];
      expect(() => parseCatalogue(cat(z))).toThrow(CatalogueError);
    },
  );
  it.each(['path', 'bytes', 'sha256', 'url'])(
    'refuses a file without %s',
    (field) => {
      const f: Record<string, unknown> = { ...goodFile };
      delete f[field];
      expect(() => parseCatalogue(cat(withZone({ files: [f] })))).toThrow(
        CatalogueError,
      );
    },
  );
  it('refuses a negative size', () => {
    const f = { ...goodFile, bytes: -10 };
    expect(() =>
      parseCatalogue(cat(withZone({ files: [f], totalBytes: -10 }))),
    ).toThrow(CatalogueError);
    expect(() => parseCatalogue(cat(withZone({ totalBytes: -1 })))).toThrow(
      CatalogueError,
    );
  });
  it('refuses a total that is not the sum of the files', () => {
    expect(() => parseCatalogue(cat(withZone({ totalBytes: 11 })))).toThrow(
      CatalogueError,
    );
  });
  it.each([
    ['63 digits', 'a'.repeat(63)],
    ['65 digits', 'a'.repeat(65)],
    ['empty', ''],
    ['not hex', 'g'.repeat(64)],
  ])('refuses a fingerprint of the wrong form: %s', (_n, bad) => {
    const f = { ...goodFile, sha256: bad };
    expect(() => parseCatalogue(cat(withZone({ files: [f] })))).toThrow(
      CatalogueError,
    );
  });
  it('refuses a zone with an empty file list', () => {
    expect(() =>
      parseCatalogue(cat(withZone({ files: [], totalBytes: 0 }))),
    ).toThrow(CatalogueError);
  });
  it.each(['../evil', '/abs/file', 'a/../b'])('refuses path %s', (p) => {
    const f = { ...goodFile, path: p };
    expect(() => parseCatalogue(cat(withZone({ files: [f] })))).toThrow(
      CatalogueError,
    );
  });
  it('JSON text that is empty cannot be parsed (JSON.parse throws)', () => {
    expect(() => parseCatalogue(JSON.parse('{}'))).toThrow(CatalogueError);
    expect(() => JSON.parse('')).toThrow();
  });
});
