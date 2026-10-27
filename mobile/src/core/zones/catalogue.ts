// Catalogue of zones, as published on GitHub: see ADR 0003, section 4.

export type Bbox = {
  lonMin: number;
  latMin: number;
  lonMax: number;
  latMax: number;
};

export type ZoneFile = {
  path: string;
  bytes: number;
  sha256: string;
  url: string;
};

export type Zone = {
  id: string;
  name: string;
  version: number;
  bbox: Bbox;
  osmDate: string;
  totalBytes: number;
  files: ZoneFile[];
};

export type Catalogue = { formatVersion: 1; zones: Zone[] };

export class CatalogueError extends Error {}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PATH_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const SHA_RE = /^[0-9a-f]{64}$/;

function fail(what: string): never {
  throw new CatalogueError(`Invalid catalogue: ${what}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(o: Record<string, unknown>, key: string, where: string): string {
  const v = o[key];
  if (typeof v !== 'string') fail(`${where}.${key} must be a string`);
  return v;
}

function positiveInt(
  o: Record<string, unknown>,
  key: string,
  where: string,
): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    fail(`${where}.${key} must be an integer of 1 or more`);
  }
  return v;
}

function number(
  o: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  where: string,
): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    fail(`${where}.${key} must be a number from ${min} to ${max}`);
  }
  return v;
}

function parseBbox(value: unknown, where: string): Bbox {
  if (!isObject(value)) fail(`${where} must be an object`);
  const bbox = {
    lonMin: number(value, 'lonMin', -180, 180, where),
    latMin: number(value, 'latMin', -90, 90, where),
    lonMax: number(value, 'lonMax', -180, 180, where),
    latMax: number(value, 'latMax', -90, 90, where),
  };
  if (bbox.lonMin >= bbox.lonMax || bbox.latMin >= bbox.latMax) {
    fail(`${where} must have min < max`);
  }
  return bbox;
}

function parseFile(value: unknown, where: string): ZoneFile {
  if (!isObject(value)) fail(`${where} must be an object`);
  const path = str(value, 'path', where);
  if (!PATH_RE.test(path)) fail(`${where}.path is not a safe path`);
  const sha256 = str(value, 'sha256', where);
  if (!SHA_RE.test(sha256)) fail(`${where}.sha256 must be 64 hex digits`);
  const url = str(value, 'url', where);
  if (!url.startsWith('https://'))
    fail(`${where}.url must start with https://`);
  return { path, bytes: positiveInt(value, 'bytes', where), sha256, url };
}

/** Checks one zone entry (catalogue entry or copy in a marker). */
export function parseZone(value: unknown, where = 'zone'): Zone {
  if (!isObject(value)) fail(`${where} must be an object`);
  const id = str(value, 'id', where);
  if (id.length < 2 || id.length > 40 || !ID_RE.test(id)) {
    fail(`${where}.id is not valid`);
  }
  const name = str(value, 'name', where);
  if (name.length < 1 || name.length > 60) fail(`${where}.name is not valid`);
  const osmDate = str(value, 'osmDate', where);
  if (!DATE_RE.test(osmDate)) fail(`${where}.osmDate is not valid`);
  const rawFiles = value.files;
  if (!Array.isArray(rawFiles) || rawFiles.length < 1) {
    fail(`${where}.files must have at least one file`);
  }
  const files = rawFiles.map((f, i) => parseFile(f, `${where}.files[${i}]`));
  const totalBytes = positiveInt(value, 'totalBytes', where);
  if (files.reduce((sum, f) => sum + f.bytes, 0) !== totalBytes) {
    fail(`${where}.totalBytes is not the sum of the files`);
  }
  return {
    id,
    name,
    version: positiveInt(value, 'version', where),
    bbox: parseBbox(value.bbox, `${where}.bbox`),
    osmDate,
    totalBytes,
    files,
  };
}

/** Reads a catalogue already parsed from JSON. Unknown fields are ignored. */
export function parseCatalogue(value: unknown): Catalogue {
  if (!isObject(value)) fail('catalogue must be an object');
  if (value.formatVersion !== 1) fail('formatVersion must be 1');
  if (!Array.isArray(value.zones)) fail('zones must be a list');
  return {
    formatVersion: 1,
    zones: value.zones.map((z, i) => parseZone(z, `zones[${i}]`)),
  };
}
