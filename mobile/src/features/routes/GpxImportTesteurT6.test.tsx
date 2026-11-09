// Tests written by the tester from the spec (docs/phases/p06-..., C9 to C13),
// ADR 0019 (sections 6, 7, 8; answers 5, 6, 7) and mockup 40 (states 6a to 6d),
// not from the code. The real screen (RoutesScreen) is driven: button
// "Importer un GPX", faked picker, real SQLite in memory. The file system is
// faked in memory (files served from the sample files of the T2 tester).
// Set T6_OUT_DIR to also write the exported files and the figures there.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import { readGpx } from '@/core/gpx/readGpx';
import { trackLengthM } from '@/core/gpx/trackLengthM';
import { gpxFileName } from '@/core/gpx/gpxFileName';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { getRoute, insertRoute, listRoutes } from '@/core/routes/routeRepo';
import type { LonLat } from '@/core/routes/savedRoute';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';
import { catalogueKey } from '@/shared-data/zones/useCatalogue';

import { RoutesScreen } from './RoutesScreen';

declare const __dirname: string;
declare function require(name: string): unknown;
type Fs = {
  readFileSync(file: string, encoding: 'utf8'): string;
  writeFileSync(file: string, data: string): void;
  mkdirSync(dir: string, options: { recursive: boolean }): void;
};
type Path = { join(...parts: string[]): string };
declare const process: { env: Record<string, string | undefined> };
const fs = require('fs') as Fs;
const path = require('path') as Path;
const EX = path.join(__dirname, '../../core/gpx/__testeur__/exemples');
const sample = (name: string) => fs.readFileSync(path.join(EX, name), 'utf8');
const OUT = process.env.T6_OUT_DIR;
function proof(name: string, data: string) {
  if (!OUT) return;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), data);
}

type FakeFile = { size: number; text: string };
const mockFs = new Map<string, FakeFile>();
const mockTextCalls: string[] = [];
const mockPicker = jest.fn();
const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockShare = jest.fn();
const mockHeights = jest.fn();
let mockDb: Promise<unknown>;
let mockInService: Zone | null | undefined;
let mockInstalled: Zone[];

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockPicker(...args),
}));
jest.mock('expo-file-system', () => {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const uriOf = (a: string | { uri: string }, name?: string) =>
    typeof a === 'string' ? a : `${a.uri}/${name}`;
  class File {
    uri: string;
    constructor(a: string | { uri: string }, name?: string) {
      this.uri = uriOf(a, name);
    }
    get size() {
      return mockFs.get(this.uri)?.size ?? 0;
    }
    text() {
      mockTextCalls.push(this.uri);
      const f = mockFs.get(this.uri);
      return f ? Promise.resolve(f.text) : Promise.reject(new Error('gone'));
    }
    create() {}
    write(text: string) {
      mockFs.set(this.uri, { size: bytes(text), text });
    }
    delete() {
      mockFs.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(a: string | { uri: string }, name?: string) {
      this.uri = uriOf(a, name);
    }
    get exists() {
      return [...mockFs.keys()].some((k) => k.startsWith(`${this.uri}/`));
    }
    delete() {
      for (const k of [...mockFs.keys()]) {
        if (k.startsWith(`${this.uri}/`)) mockFs.delete(k);
      }
    }
    create() {}
  }
  return { File, Directory, Paths: { cache: { uri: 'file:///c' } } };
});
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computePointHeights: (...args: unknown[]) => mockHeights(...args),
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneInService: () => mockInService,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({
    data: mockInstalled.map((zone) => ({ zone, installedAt: '2026-11-01' })),
  }),
}));

const zone = (id: string, name: string, bbox: Zone['bbox']): Zone => ({
  id,
  name,
  version: 5,
  bbox,
  osmDate: '2026-10-01',
  totalBytes: 95_400_000,
  files: [],
});
const NANCY = zone('nancy', 'Nancy', {
  lonMin: 5.84,
  lonMax: 6.52,
  latMin: 48.47,
  latMax: 48.92,
});
const METZ = zone('metz', 'Metz', {
  lonMin: 5.9,
  lonMax: 6.4,
  latMin: 48.95,
  latMax: 49.3,
});

const URI = 'file:///cache/DocumentPicker/choisi.gpx';
function choose(text: string, fileName = 'choisi.gpx', size?: number) {
  const bytes = new TextEncoder().encode(text).length;
  mockFs.set(URI, { size: bytes, text });
  mockPicker.mockResolvedValue({
    canceled: false,
    assets: [{ uri: URI, name: fileName, size: size ?? bytes }],
  });
}
const trk = (pts: [number, number][], name?: string, ele = true) =>
  `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1">` +
  (name === undefined ? '' : `<metadata><name>${name}</name></metadata>`) +
  `<trk><trkseg>${pts
    .map(
      ([lon, lat], i) =>
        `<trkpt lat="${lat}" lon="${lon}">${ele ? `<ele>${200 + i}</ele>` : ''}</trkpt>`,
    )
    .join('')}</trkseg></trk></gpx>`;
const IN_NANCY: [number, number][] = [
  [6.18, 48.69],
  [6.2, 48.71],
];
const IN_METZ: [number, number][] = [
  [6.1, 49.1],
  [6.12, 49.12],
];
const NOWHERE: [number, number][] = [
  [-60, -30],
  [-59.9, -30.1],
];

let db: NodeSqlDb;
let client: QueryClient;
let alert: jest.SpyInstance;
const originalOs = Platform.OS;

async function settle(n = 6) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
async function open() {
  await render(
    <QueryClientProvider client={client}>
      <RoutesScreen onDownloadZone={onDownload} />
    </QueryClientProvider>,
  );
  await settle();
}
const onDownload = jest.fn();
async function importFile() {
  await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
  await settle();
}
const saved = () => listRoutes(db);
const lastAlert = () => {
  const [title, message, buttons] = alert.mock.calls.at(-1)!;
  return { title, message, buttons } as {
    title: string;
    message: string;
    buttons: { text: string; onPress?: () => void }[];
  };
};
async function gpxRoute(id: number) {
  const r = await getRoute(db, id);
  if (!r || !r.readable || r.origin !== 'gpx') throw new Error('no gpx route');
  return r;
}

// Independent haversine (mean radius 6 371 008.8 m): used for the 1 m check.
function dist(a: LonLat, b: LonLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockFs.clear();
  mockTextCalls.length = 0;
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  mockInService = NANCY;
  mockInstalled = [NANCY];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  mockShare.mockResolvedValue(undefined);
  mockHeights.mockImplementation(async (shape: unknown[]) => ({
    ok: true,
    heights: shape.map((_p, i) => 300 + i),
  }));
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    value: originalOs,
    configurable: true,
  });
  client.clear();
  jest.restoreAllMocks();
  db.close();
});

describe('C10: the sample files of the common apps join the list', () => {
  const cases: [string, string, string][] = [
    ['Strava', 'strava.gpx', 'Sortie VTT du matin'],
    ['Garmin (BOM, CRLF)', 'garmin-bom-crlf.gpx', 'Garmin Boucle'],
    ['Komoot', 'komoot.gpx', 'Tour du Haut-Barr & Saverne'],
    ['OsmAnd', 'osmand.gpx', 'OsmAnd piste'],
    [
      'Openrunner (route only)',
      'openrunner-route.gpx',
      'Openrunner parcours 123',
    ],
    ['GPX 1.0', 'gpx10.gpx', 'Ancien format 1.0'],
    ['several segments', 'multi-segments-multi-traces.gpx', 'Première'],
  ];
  it.each(cases)('%s', async (_label, file, name) => {
    // A sample far from the zone: the sheet opens, then "Plus tard".
    const expected = readGpx(sample(file));
    if (!expected.ok) throw new Error('sample refused');
    choose(sample(file), file);
    await open();
    await importFile();
    const rows = await saved();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(name);
    expect(rows[0].origin).toBe('gpx');
    const route = await gpxRoute(rows[0].id);
    expect(route.track).toEqual(expected.track);
    expect(route.elevations).toEqual(
      expected.elevations.some((e) => e !== null) ? expected.elevations : null,
    );
    // At the top of the list on screen.
    expect(
      screen.getAllByLabelText(/^Actions de /)[0].props.accessibilityLabel,
    ).toBe(`Actions de ${name}`);
    expect(alert).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(
      screen.queryByText('GPX hors de vos zones') ? 1 : 0,
    );
  });

  it('a second import goes above the first one', async () => {
    choose(trk(IN_NANCY, 'Premier'));
    await open();
    await importFile();
    choose(trk(IN_NANCY, 'Second'));
    await importFile();
    expect((await saved()).map((r) => r.name)).toEqual(['Second', 'Premier']);
    const labels = screen
      .getAllByLabelText(/^Actions de /)
      .map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(['Actions de Second', 'Actions de Premier']);
  });

  it('the picker is opened for any file type, copied to the cache', async () => {
    choose(trk(IN_NANCY, 'X'));
    await open();
    await importFile();
    expect(mockPicker).toHaveBeenCalledWith(
      expect.objectContaining({ type: '*/*', copyToCacheDirectory: true }),
    );
    // The copy in the cache is erased.
    expect(mockFs.has(URI)).toBe(false);
  });
});

describe('C10: refusals, with the exact texts of mockup 40 (6a)', () => {
  async function refusal(sentence: string) {
    expect(alert).toHaveBeenCalledTimes(1);
    const { title, message, buttons } = lastAlert();
    expect(title).toBe('Import impossible');
    expect(message).toBe(sentence);
    expect(buttons.map((b) => b.text)).toEqual(['OK']);
    expect(await saved()).toEqual([]);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockFs.has(URI)).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  }
  const ILLISIBLE = "Ce fichier n'est pas un GPX lisible.";

  it('empty file (0 byte)', async () => {
    choose('');
    await open();
    await importFile();
    await refusal('Ce fichier est vide.');
  });
  it('file of spaces and line breaks', async () => {
    choose('  \n\t \r\n ');
    await open();
    await importFile();
    await refusal('Ce fichier est vide.');
  });
  it('not a GPX (text, XML of another kind, broken XML)', async () => {
    for (const text of [
      'Ceci est une photo',
      '<kml><Document/></kml>',
      '<gpx><trk><trkseg><trkpt lat="1" lon="1"></trkseg></trk></gpx>',
    ]) {
      alert.mockClear();
      choose(text);
      await open();
      await importFile();
      await refusal(ILLISIBLE);
    }
  });
  it('DOCTYPE with an external entity: unreadable, no network, not followed', async () => {
    choose(
      '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><gpx version="1.1"><metadata><name>&xxe;</name></metadata><trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>',
    );
    await open();
    await importFile();
    await refusal(ILLISIBLE);
  });
  it('a plain DOCTYPE without entity is also unreadable (answer 7)', async () => {
    choose(
      '<?xml version="1.0"?><!DOCTYPE gpx><gpx version="1.1"><trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>',
    );
    await open();
    await importFile();
    await refusal(ILLISIBLE);
  });
  it('GPX of isolated points only', async () => {
    choose('<gpx version="1.1"><wpt lat="48.6" lon="6.1"/></gpx>');
    await open();
    await importFile();
    await refusal(
      'Ce fichier GPX ne contient aucun tracé. RutaPulse lit les traces et les routes, pas les points isolés.',
    );
  });
  it('a track of one point only', async () => {
    choose(trk([[6, 48]]));
    await open();
    await importFile();
    await refusal(
      'Ce fichier GPX ne contient aucun tracé. RutaPulse lit les traces et les routes, pas les points isolés.',
    );
  });
  it('34 200 000 bytes: "34 Mo" and the content is never read', async () => {
    mockFs.set(URI, { size: 34_200_000, text: trk(IN_NANCY, 'Gros') });
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: URI, name: 'gros.gpx', size: 34_200_000 }],
    });
    await open();
    await importFile();
    await refusal(
      'Ce fichier pèse 34 Mo. RutaPulse importe les GPX de 20 Mo au plus.',
    );
    expect(mockTextCalls).toEqual([]);
  });
  it('20 000 001 bytes is refused, never read; the text never says it weighs 20 Mo', async () => {
    mockFs.set(URI, { size: 20_000_001, text: trk(IN_NANCY, 'Limite') });
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: URI, name: 'limite.gpx', size: 20_000_001 }],
    });
    await open();
    await importFile();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(lastAlert().message).toMatch(
      /^Ce fichier pèse 2[01] Mo\. RutaPulse importe les GPX de 20 Mo au plus\.$|^Ce fichier pèse 2[01] Mo\. RutaPulse importe les GPX de 20 Mo au plus\.$/,
    );
    expect(lastAlert().message).not.toMatch(/pèse 20[\s ]Mo/);
    expect(await saved()).toEqual([]);
    expect(mockTextCalls).toEqual([]);
  });
  it('size unknown to the picker: the size of the file is read, still refused unread', async () => {
    mockFs.set(URI, { size: 25_000_000, text: trk(IN_NANCY, 'Gros') });
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: URI, name: 'gros.gpx' }],
    });
    await open();
    await importFile();
    expect(lastAlert().message).toContain('pèse 25');
    expect(mockTextCalls).toEqual([]);
  });
  it('exactly 20 000 000 bytes is accepted', async () => {
    choose(trk(IN_NANCY, 'Pile 20 Mo'), 'pile.gpx', 20_000_000);
    await open();
    await importFile();
    expect(alert).not.toHaveBeenCalled();
    expect(await saved()).toHaveLength(1);
  });
  it('a file that cannot be read gives "illisible", and the copy is erased', async () => {
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: URI, name: 'a.gpx', size: 12 }],
    });
    await open();
    await importFile();
    await refusal(ILLISIBLE);
  });
  it('picker cancelled: nothing at all', async () => {
    mockPicker.mockResolvedValue({ canceled: true, assets: null });
    await open();
    await importFile();
    expect(alert).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(await saved()).toEqual([]);
    expect(mockTextCalls).toEqual([]);
    expect(screen.getByText('Importer un GPX')).toBeTruthy();
  });
});

describe('the name of an imported GPX', () => {
  const nameless = (pts = IN_NANCY) => trk(pts);
  async function nameOf(text: string, fileName: string) {
    choose(text, fileName);
    await open();
    await importFile();
    return (await saved())[0]?.name;
  }
  it('uses the name in the GPX', async () => {
    expect(
      await nameOf(trk(IN_NANCY, 'Rando du Haut-du-Lièvre'), 'a.gpx'),
    ).toBe('Rando du Haut-du-Lièvre');
  });
  it('without name: the name of the file without ".gpx"', async () => {
    expect(await nameOf(nameless(), 'Sortie du dimanche.gpx')).toBe(
      'Sortie du dimanche',
    );
  });
  it('without name and a file in capitals: ".GPX" is also removed', async () => {
    expect(await nameOf(nameless(), 'SORTIE.GPX')).toBe('SORTIE');
  });
  it('a name of tabs and line breaks: the name of the file', async () => {
    expect(await nameOf(trk(IN_NANCY, '&#9;&#10;&#13;'), 'Mon tour.gpx')).toBe(
      'Mon tour',
    );
  });
  it('a name of an unauthorised control character: refused or the name of the file, never a control character', async () => {
    choose(trk(IN_NANCY, '&#1;&#2;'), 'Mon tour.gpx');
    await open();
    await importFile();
    const rows = await saved();
    if (rows.length === 0) {
      expect(lastAlert().message).toBe("Ce fichier n'est pas un GPX lisible.");
    } else {
      expect(rows[0].name).toBe('Mon tour');
    }
  });
  it('a file with no usable name either: "Itinéraire du {jour}"', async () => {
    for (const fileName of ['.gpx', '', '   .gpx']) {
      db.close();
      db = createNodeSqlDb();
      await migrate(db, MIGRATIONS);
      mockDb = Promise.resolve(db);
      const name = await nameOf(nameless(), fileName);
      expect(name).toMatch(/^Itinéraire du \d{1,2}(er)? [^\s]+\.?$/);
    }
  });
  it('two default names the same day: "(2)" (answer 2)', async () => {
    choose(nameless(), '.gpx');
    await open();
    await importFile();
    choose(nameless(), '.gpx');
    await importFile();
    const names = (await saved()).map((r) => r.name);
    expect(names).toHaveLength(2);
    expect(names[0]).toBe(`${names[1]} (2)`);
  });
  it('a name of 70 characters is cut to 60 (and the import works)', async () => {
    const name = await nameOf(trk(IN_NANCY, 'A'.repeat(70)), 'a.gpx');
    expect(name).toBe('A'.repeat(60));
  });
  it('a name of 70 emoji is cut to 60 code points', async () => {
    const name = await nameOf(trk(IN_NANCY, '🚵'.repeat(70)), 'a.gpx');
    expect([...(name ?? '')]).toHaveLength(60);
  });
  it('a name of 61 characters without GPX name, taken from the file: cut to 60', async () => {
    const name = await nameOf(nameless(), `${'B'.repeat(70)}.gpx`);
    expect(name).toBe('B'.repeat(60));
  });
  it('spaces around and inside the name are normalised', async () => {
    expect(await nameOf(trk(IN_NANCY, '   Tour   du   lac  '), 'a.gpx')).toBe(
      'Tour du lac',
    );
  });
});

describe('answers 5 and 6 and the figures of an imported GPX', () => {
  it('opens the Infos screen of the new route at once, with no message', async () => {
    choose(trk(IN_NANCY, 'Dans Nancy'));
    await open();
    await importFile();
    const [route] = await saved();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/route/${route.id}`);
    expect(alert).not.toHaveBeenCalled();
    expect(screen.queryByText('GPX hors de vos zones')).toBeNull();
  });
  it('duration at 10 km/h: 42,1 km gives 4 h 13 (15 156 s)', async () => {
    // 42.1 km along a meridian, on the sphere of the engine (R = 6 378 160 m).
    const span = 42_100 / ((6_378_160 * Math.PI) / 180);
    const pts: [number, number][] = Array.from({ length: 101 }, (_, i) => [
      6.2,
      48.5 + (span * i) / 100,
    ]);
    choose(trk(pts, 'Longue'));
    await open();
    await importFile();
    const [row] = await saved();
    expect(row.distanceKm).toBeGreaterThan(42.05);
    expect(row.distanceKm).toBeLessThan(42.15);
    expect(row.durationS).toBeGreaterThanOrEqual(15_120);
    expect(row.durationS).toBeLessThanOrEqual(15_180);
    // 4 h 13 min = 15 180 s: rounds to the minute.
    expect(Math.round(row.durationS / 60)).toBe(253);
  });
});

describe('C12: a GPX outside every zone', () => {
  const sheetText = () => screen.getByTestId('outside-text').props.children;
  const flat = () => String(sheetText().join?.('') ?? sheetText());
  const HEAD =
    "L'itinéraire est importé, avec sa distance. Le D+, le terrain et la difficulté sont indisponibles hors zone.";

  it('is accepted outside all zones; distance computed, D+ unavailable, no zone', async () => {
    choose(trk(NOWHERE, 'Patagonie'));
    await open();
    await importFile();
    const [row] = await saved();
    expect(row.zoneId).toBeNull();
    const route = await gpxRoute(row.id);
    expect(route.distanceKm).toBeCloseTo(trackLengthM(route.track) / 1000, 6);
    expect(route.distanceKm).toBeGreaterThan(10);
    expect(route.ascentM).toBeNull();
    expect(route.descentM).toBeNull();
    expect(route.zone).toBeNull();
    expect(screen.getByText('GPX hors de vos zones')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('catalogue in memory knows Metz: the sheet offers it with its size', async () => {
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    choose(trk(IN_METZ, 'Metz – Gorze'));
    await open();
    await importFile();
    expect(flat()).toBe(
      `${HEAD} Ce tracé est dans la zone Metz, pas encore sur le téléphone.`,
    );
    expect(screen.getByText(/^Télécharger Metz · 95[\s ]Mo$/)).toBeTruthy();
    expect(screen.getByText('Plus tard')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('outside-download'));
    expect(onDownload).toHaveBeenCalledWith(METZ);
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
  });

  it('"Plus tard" closes the sheet and opens the Infos screen of the GPX', async () => {
    client.setQueryData(catalogueKey, { formatVersion: 1, zones: [METZ] });
    choose(trk(IN_METZ, 'Metz'));
    await open();
    await importFile();
    await fireEvent.press(screen.getByText('Plus tard'));
    const [row] = await saved();
    expect(mockPush).toHaveBeenCalledWith(`/route/${row.id}`);
    expect(screen.queryByText('GPX hors de vos zones')).toBeNull();
  });

  it('does not propose an installed zone again', async () => {
    mockInstalled = [NANCY, METZ];
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    choose(trk(IN_METZ, 'Metz déjà là'));
    await open();
    await importFile();
    expect(flat()).toBe(
      `${HEAD} Ce tracé n'est dans aucune zone de RutaPulse pour l'instant.`,
    );
  });

  it('no zone in the catalogue: one "Fermer" button', async () => {
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    choose(trk(NOWHERE, 'Ailleurs'));
    await open();
    await importFile();
    expect(flat()).toBe(
      `${HEAD} Ce tracé n'est dans aucune zone de RutaPulse pour l'instant.`,
    );
    expect(screen.getByText('Fermer')).toBeTruthy();
    expect(screen.queryByText('Plus tard')).toBeNull();
    expect(screen.queryByText(/^Télécharger/)).toBeNull();
    await fireEvent.press(screen.getByText('Fermer'));
    const [row] = await saved();
    expect(mockPush).toHaveBeenCalledWith(`/route/${row.id}`);
  });

  it('no network (airplane mode): "Voir les zones" then "Plus tard"', async () => {
    choose(trk(IN_METZ, 'Hors ligne'));
    await open();
    await importFile();
    expect(flat()).toBe(
      `${HEAD} Sans réseau, RutaPulse ne peut pas chercher la zone de ce tracé.`,
    );
    expect(screen.getByText('Voir les zones')).toBeTruthy();
    expect(screen.getByText('Plus tard')).toBeTruthy();
    expect(screen.queryByText(/^Télécharger/)).toBeNull();
    expect(await saved()).toHaveLength(1);
    await fireEvent.press(screen.getByText('Voir les zones'));
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
  });

  it('a start in the installed zone in service: the zone is attached, no sheet', async () => {
    choose(trk(IN_NANCY, 'Chez nous'));
    await open();
    await importFile();
    const [row] = await saved();
    expect(row.zoneId).toBe('nancy');
    expect(screen.queryByText('GPX hors de vos zones')).toBeNull();
    expect(mockPush).toHaveBeenCalledWith(`/route/${row.id}`);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('a start outside, an end in the zone: no zone (the start counts)', async () => {
    choose(
      trk(
        [
          [6.18, 49.5],
          [6.2, 48.71],
        ],
        'Arrive à Nancy',
      ),
    );
    await open();
    await importFile();
    expect((await saved())[0].zoneId).toBeNull();
    expect(screen.getByText('GPX hors de vos zones')).toBeTruthy();
  });

  it('no zone in service at all (null): still accepted', async () => {
    mockInService = null;
    mockInstalled = [];
    choose(trk(IN_NANCY, 'Sans zone'));
    await open();
    await importFile();
    expect(await saved()).toHaveLength(1);
    expect(screen.getByText('GPX hors de vos zones')).toBeTruthy();
  });
});

describe('C9: export through the menu of the list, the share sheet', () => {
  async function exportFromList(name: string) {
    await fireEvent.press(screen.getByLabelText(`Actions de ${name}`));
    const { buttons } = lastAlert();
    expect(buttons[1].text).toBe('Exporter en GPX');
    await act(async () => buttons[1].onPress?.());
    await settle();
  }
  const exported = () => {
    const call = mockShare.mock.calls.at(-1)!;
    const uri = call[0] as string;
    return { uri, options: call[1], text: mockFs.get(uri)!.text };
  };

  type Case = {
    label: string;
    file: string;
    name: string;
    make: () => Promise<number>;
    ele: boolean;
    zone: Zone | null;
  };
  const created = (name: string) => () =>
    insertRoute(db, sampleCreated({ name }));
  const cases: Case[] = [
    {
      label: 'created with altitudes',
      file: 'cree-avec-altitudes.gpx',
      name: 'Boucle du Bois de la Côte',
      make: created('Boucle du Bois de la Côte'),
      ele: true,
      zone: NANCY,
    },
    {
      label: 'created without altitudes (zone absent)',
      file: 'cree-sans-altitudes.gpx',
      name: 'Boucle sans zone',
      make: created('Boucle sans zone'),
      ele: false,
      zone: null,
    },
    {
      label: 'imported GPX',
      file: 'gpx-importe.gpx',
      name: 'Sortie importée',
      make: () => insertRoute(db, sampleGpx({ name: 'Sortie importée' })),
      ele: true,
      zone: null,
    },
    {
      label: 'name with & < > accents and emoji',
      file: 'nom-special.gpx',
      name: 'Tour & <Haut-Barr> "été" Saverne 🚵',
      make: () =>
        insertRoute(
          db,
          sampleGpx({ name: 'Tour & <Haut-Barr> "été" Saverne 🚵' }),
        ),
      ele: true,
      zone: null,
    },
    {
      label: 'imported GPX of a real app (Komoot) with partial altitudes',
      file: 'komoot-reexporte.gpx',
      name: 'Tour du Haut-Barr & Saverne',
      make: async () => {
        const r = readGpx(sample('komoot.gpx'));
        if (!r.ok) throw new Error('refused');
        return insertRoute(
          db,
          sampleGpx({
            name: r.name,
            track: r.track,
            elevations: r.elevations,
          }),
        );
      },
      ele: true,
      zone: null,
    },
  ];

  it.each(cases)(
    '$label: file valid for the schema, share sheet opened',
    async (c) => {
      mockInService = c.zone;
      mockInstalled = c.zone ? [c.zone] : [];
      await c.make();
      await open();
      await exportFromList(c.name);
      expect(alert.mock.calls.at(-1)![0]).not.toBe('Export impossible');
      expect(mockShare).toHaveBeenCalledTimes(1);
      const { uri, options, text } = exported();
      expect(options).toEqual({
        mimeType: 'application/gpx+xml',
        UTI: 'com.topografix.gpx',
        dialogTitle: c.name,
      });
      expect(uri.startsWith('file:///c/export/')).toBe(true);
      expect(uri.endsWith('.gpx')).toBe(true);
      expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(
        true,
      );
      expect(text.charCodeAt(0)).not.toBe(0xfeff);
      expect(text).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
      expect(text).toContain('version="1.1"');
      expect(text).not.toContain('\r');
      expect((text.match(/<trk>/g) ?? []).length).toBe(1);
      expect((text.match(/<trkseg>/g) ?? []).length).toBe(1);
      expect(text.includes('<ele>')).toBe(c.ele);
      // The name, escaped, then read back as the same text.
      const back = readGpx(text);
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.name).toBe(c.name);
      proof(`gpx-exportes/${c.file}`, text);
    },
  );

  it('a name with & and < is escaped in the file', async () => {
    await insertRoute(db, sampleGpx({ name: 'A & B <C>' }));
    await open();
    await exportFromList('A & B <C>');
    const { text } = exported();
    expect(text).toContain('<name>A &amp; B &lt;C&gt;</name>');
    expect(text).not.toContain('A & B');
  });

  it('created with altitudes: one <ele> per point, from the engine', async () => {
    await insertRoute(db, sampleCreated({ name: 'Avec' }));
    await open();
    await exportFromList('Avec');
    const { text } = exported();
    const points = text.match(/<trkpt /g)!.length;
    expect(points).toBeGreaterThanOrEqual(3);
    expect(text.match(/<ele>/g)!.length).toBe(points);
    expect(mockHeights).toHaveBeenCalledTimes(1);
  });

  it('created, zone absent: no call to the engine, no altitude', async () => {
    mockInService = null;
    mockInstalled = [];
    await insertRoute(db, sampleCreated({ name: 'Sans' }));
    await open();
    await exportFromList('Sans');
    expect(mockHeights).not.toHaveBeenCalled();
    expect(exported().text).not.toContain('<ele>');
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  it('created, the engine fails: still exported, without altitude', async () => {
    mockHeights.mockResolvedValue({ ok: false, reason: 'failed' });
    await insertRoute(db, sampleCreated({ name: 'Panne' }));
    await open();
    await exportFromList('Panne');
    expect(exported().text).not.toContain('<ele>');
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  it('safe file names: forbidden characters become "-", accents stay', async () => {
    expect(gpxFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j.gpx');
    expect(gpxFileName('Été à Nancy')).toBe('Été à Nancy.gpx');
    expect(gpxFileName('tab\tnew\nline')).toBe('tab-new-line.gpx');
    expect(gpxFileName('x\u0001y\u007fz')).toBe('x-y-z.gpx');
    expect(gpxFileName('///')).toBe('---.gpx');
    expect(gpxFileName('   ')).toBe('itineraire.gpx');
    expect(gpxFileName('')).toBe('itineraire.gpx');
    const long = gpxFileName('é'.repeat(60));
    expect(long.length).toBeLessThanOrEqual(64);
    expect(gpxFileName('Boucle: 5/6')).not.toMatch(/[/\\:*?"<>|]/);
  });

  it('the file of the share sheet has a safe name on the path', async () => {
    await insertRoute(db, sampleGpx({ name: 'Boucle: "5/6" <ok>?' }));
    await open();
    await exportFromList('Boucle: "5/6" <ok>?');
    const { uri } = exported();
    expect(uri).toBe(
      'file:///c/export/Boucle- -5-6- -ok-- .gpx'.replace('- .gpx', '-.gpx'),
    );
  });

  it('one file at a time in the export folder', async () => {
    await insertRoute(db, sampleGpx({ name: 'Un' }));
    await insertRoute(db, sampleGpx({ name: 'Deux' }));
    await open();
    await exportFromList('Un');
    await exportFromList('Deux');
    const files = [...mockFs.keys()].filter((k) => k.includes('/export/'));
    expect(files).toEqual(['file:///c/export/Deux.gpx']);
  });

  it('a failure of the share sheet or of the disk: "Export impossible"', async () => {
    mockShare.mockRejectedValue(new Error('no'));
    await insertRoute(db, sampleGpx({ name: 'Raté' }));
    await open();
    await exportFromList('Raté');
    expect(lastAlert().title).toBe('Export impossible');
    expect(lastAlert().message).toBe(
      "Le fichier GPX n'a pas pu être écrit. Réessayez.",
    );
  });
});

describe('C11: export then import again, by the real paths', () => {
  async function exportFromList(name: string) {
    await fireEvent.press(screen.getByLabelText(`Actions de ${name}`));
    await act(async () => lastAlert().buttons[1].onPress?.());
    await settle();
  }
  async function reimport(): Promise<{ id: number; text: string }> {
    const call = mockShare.mock.calls.at(-1)!;
    const uri = call[0] as string;
    const file = mockFs.get(uri)!;
    const fileName = uri.split('/').at(-1)!;
    const before = (await saved()).map((r) => r.id);
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri, name: fileName, size: file.size }],
    });
    await importFile();
    const after = (await saved()).map((r) => r.id);
    const fresh = after.filter((id) => !before.includes(id));
    expect(fresh).toHaveLength(1);
    return { id: fresh[0], text: file.text };
  }
  const figures: string[] = [];
  afterAll(() => proof('aller-retour.txt', figures.join('\n') + '\n'));

  function compare(label: string, a: LonLat[], b: LonLat[]) {
    expect(b).toHaveLength(a.length);
    let worst = 0;
    a.forEach((p, i) => {
      worst = Math.max(worst, dist(p, b[i]));
    });
    expect(worst).toBeLessThanOrEqual(1);
    const la = trackLengthM(a);
    const lb = trackLengthM(b);
    expect(Math.abs(la - lb)).toBeLessThanOrEqual(10);
    figures.push(
      `${label}: ${a.length} points, écart max ${worst.toFixed(4)} m, longueur ${la.toFixed(3)} m -> ${lb.toFixed(3)} m (écart ${Math.abs(la - lb).toFixed(4)} m)`,
    );
  }

  const apps: [string, string][] = [
    ['Strava', 'strava.gpx'],
    ['Garmin', 'garmin-bom-crlf.gpx'],
    ['Komoot', 'komoot.gpx'],
    ['OsmAnd', 'osmand.gpx'],
    ['Openrunner', 'openrunner-route.gpx'],
    ['GPX 1.0', 'gpx10.gpx'],
    ['multi-segments', 'multi-segments-multi-traces.gpx'],
  ];
  it.each(apps)(
    'imported %s: same track to 1 m, same length to 10 m',
    async (label, file) => {
      const original = readGpx(sample(file));
      if (!original.ok) throw new Error('refused');
      choose(sample(file), file);
      await open();
      await importFile();
      const [first] = await saved();
      await exportFromList(first.name);
      const { id } = await reimport();
      const again = await gpxRoute(id);
      compare(label, original.track, again.track);
      const firstRoute = await gpxRoute(first.id);
      expect(again.elevations).toEqual(firstRoute.elevations);
      expect(again.name).toBe(first.name);
    },
  );

  it('a track of 3 000 points with altitudes, high precision', async () => {
    const pts: [number, number][] = Array.from({ length: 3000 }, (_, i) => [
      6.1 + Math.sin(i / 90) * 0.05 + i * 1e-5 + i * 1.23456789e-9,
      48.6 + Math.cos(i / 70) * 0.04 + i * 7.7654321e-9,
    ]);
    choose(trk(pts, 'Longue boucle'));
    await open();
    await importFile();
    const [first] = await saved();
    const original = (await gpxRoute(first.id)).track;
    await exportFromList('Longue boucle');
    const { id } = await reimport();
    compare('3000 points', original, (await gpxRoute(id)).track);
  });

  it('a created route (with altitudes): the file holds its track, read again identically', async () => {
    const id = await insertRoute(db, sampleCreated({ name: 'Créé' }));
    expect(id).toBeGreaterThan(0);
    await open();
    await exportFromList('Créé');
    const exportedText = mockFs.get(mockShare.mock.calls.at(-1)![0])!.text;
    const parsed = readGpx(exportedText);
    if (!parsed.ok) throw new Error('refused');
    // The shape of the computed leg of sampleCreated, in order.
    const expectedStart: LonLat[] = [
      [6.18, 48.69],
      [6.185, 48.695],
      [6.19, 48.7],
    ];
    expectedStart.forEach((p, i) =>
      expect(dist(p, parsed.track[i])).toBeLessThan(0.2),
    );
    const { id: newId } = await reimport();
    compare('créé', parsed.track, (await gpxRoute(newId)).track);
    expect((await gpxRoute(newId)).elevations).toEqual(parsed.elevations);
  });
});

describe('C13 (indicative, Jest, not release): a GPX of 10 000 points', () => {
  it('is imported by the screen path; the time is recorded', async () => {
    const pts: [number, number][] = Array.from({ length: 10_000 }, (_, i) => [
      6.0 + (i % 100) * 0.003 + Math.sin(i / 50) * 0.01,
      48.55 + Math.floor(i / 100) * 0.002 + Math.cos(i / 40) * 0.003,
    ]);
    const text = trk(pts, 'Dix mille points');
    choose(text);
    await open();
    const start = Date.now();
    await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
    let rows = await saved();
    while (rows.length === 0 && Date.now() - start < 20_000) {
      await settle(1);
      rows = await saved();
    }
    const elapsed = Date.now() - start;
    expect(rows).toHaveLength(1);
    expect((await gpxRoute(rows[0].id)).track.length).toBeGreaterThan(9_000);
    proof(
      'c13-indicatif.txt',
      `10 000 points, ${text.length} caractères, import par l'écran sous Jest : ${elapsed} ms (indicatif, pas la version finale)\n`,
    );
    expect(elapsed).toBeLessThan(3000);
  });
});
