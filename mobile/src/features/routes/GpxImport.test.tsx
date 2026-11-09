// The import of a GPX file from the Itinéraires tab (ADR 0019, sections 6 and
// 7; spec C10, C12; mockup 40, states 6a to 6d). The database is a real
// SQLite in memory; the picker, the file system, the router and the zones are
// faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Alert } from 'react-native';

import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { getRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { trackLengthM } from '@/core/gpx/trackLengthM';
import type { Zone } from '@/core/zones/catalogue';
import { catalogueKey } from '@/shared-data/zones/useCatalogue';

import { RoutesScreen } from './RoutesScreen';

type FakeFile = { size: number; text?: string };
const mockFiles: Record<string, FakeFile> = {};
const mockTextCalls: string[] = [];
const mockPicker = jest.fn();
const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockDb: Promise<unknown>;

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockPicker(...args),
}));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockFiles[this.uri]?.size ?? 0;
    }
    text() {
      mockTextCalls.push(this.uri);
      return Promise.resolve(mockFiles[this.uri]?.text ?? '');
    }
    delete() {}
  }
  return { File, Directory: class {}, Paths: {} };
});
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
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
let mockInService: Zone | null | undefined;
let mockInstalled: Zone[];

const URI = 'file:///cache/DocumentPicker/x.gpx';
const gpxText = (name: string, start: [number, number]) =>
  `<?xml version="1.0"?><gpx version="1.1"><metadata><name>${name}</name></metadata>` +
  `<trk><trkseg><trkpt lat="${start[1]}" lon="${start[0]}"><ele>200</ele></trkpt>` +
  `<trkpt lat="${start[1] + 0.05}" lon="${start[0] + 0.05}"><ele>250</ele></trkpt>` +
  `</trkseg></trk></gpx>`;
const IN_NANCY: [number, number] = [6.18, 48.69];
const IN_METZ: [number, number] = [6.1, 49.1];

function chooseFile(file: FakeFile, name = 'x.gpx', size?: number) {
  mockFiles[URI] = file;
  mockPicker.mockResolvedValue({
    canceled: false,
    assets: [{ uri: URI, name, size: size ?? file.size }],
  });
}
function chooseGpx(text: string, name = 'x.gpx') {
  chooseFile({ size: text.length, text }, name);
}

let db: NodeSqlDb;
let client: QueryClient;
let alert: jest.SpyInstance;
const onDownloadZone = jest.fn();

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
async function open() {
  await render(
    <QueryClientProvider client={client}>
      <RoutesScreen onDownloadZone={onDownloadZone} />
    </QueryClientProvider>,
  );
  await settle();
}
async function importFile() {
  await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
  await settle();
}
const lastAlert = () => {
  const [title, message, buttons] = alert.mock.calls.at(-1)!;
  return { title, message, buttons } as {
    title: string;
    message: string;
    buttons: { text: string }[];
  };
};
const saved = () => listRoutes(db);

beforeEach(async () => {
  jest.clearAllMocks();
  mockTextCalls.length = 0;
  for (const key of Object.keys(mockFiles)) delete mockFiles[key];
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  mockInService = NANCY;
  mockInstalled = [NANCY];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
});
afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
  db.close();
});

describe('a refused file (state 6a)', () => {
  async function expectRefusal(sentence: string) {
    expect(alert).toHaveBeenCalledTimes(1);
    const { title, message, buttons } = lastAlert();
    expect(title).toBe('Import impossible');
    expect(message).toBe(sentence);
    expect(buttons.map((b) => b.text)).toEqual(['OK']);
    expect(await saved()).toEqual([]);
    expect(mockPush).not.toHaveBeenCalled();
  }

  it('says "vide" for a file of 0 byte', async () => {
    chooseFile({ size: 0 });
    await open();
    await importFile();
    await expectRefusal('Ce fichier est vide.');
  });

  it('says "vide" for a file of spaces', async () => {
    chooseFile({ size: 3, text: '   ' });
    await open();
    await importFile();
    await expectRefusal('Ce fichier est vide.');
  });

  it('says "illisible" for a file that is not a GPX', async () => {
    chooseGpx('Ceci est une photo');
    await open();
    await importFile();
    await expectRefusal("Ce fichier n'est pas un GPX lisible.");
  });

  it('says "illisible" for an external entity, and calls no network', async () => {
    chooseGpx(
      '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY x SYSTEM "http://example.com/x">]><gpx><trk><trkseg>' +
        '<trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>',
    );
    await open();
    await importFile();
    await expectRefusal("Ce fichier n'est pas un GPX lisible.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says "sans tracé" for a GPX of isolated points', async () => {
    chooseGpx('<gpx version="1.1"><wpt lat="48.6" lon="6.1"/></gpx>');
    await open();
    await importFile();
    await expectRefusal(
      'Ce fichier GPX ne contient aucun tracé. RutaPulse lit les traces et les routes, pas les points isolés.',
    );
  });

  it('says "trop gros" with the size in MB, and does not read the file', async () => {
    chooseFile({ size: 34_200_000, text: gpxText('Gros', IN_NANCY) });
    await open();
    await importFile();
    await expectRefusal(
      'Ce fichier pèse 34 Mo. RutaPulse importe les GPX de 20 Mo au plus.',
    );
    expect(mockTextCalls).toEqual([]);
  });

  it('never says a size under 21 MB', async () => {
    chooseFile({ size: 20_000_100 });
    await open();
    await importFile();
    expect(lastAlert().message).toContain('pèse 21 Mo');
  });
});

describe('a cancelled picker', () => {
  it('does nothing', async () => {
    mockPicker.mockResolvedValue({ canceled: true, assets: null });
    await open();
    await importFile();
    expect(alert).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(await saved()).toEqual([]);
    expect(screen.getByText('Importer un GPX')).toBeTruthy();
  });
});

describe('a GPX that starts in the zone in service (state 6b)', () => {
  it('is kept and its Infos screen opens, with no message and no network', async () => {
    chooseGpx(gpxText('Rando VTT Ludres', IN_NANCY), 'ludres.gpx');
    await open();
    await importFile();
    const [route] = await saved();
    expect(route.name).toBe('Rando VTT Ludres');
    expect(route.origin).toBe('gpx');
    expect(route.zoneId).toBe('nancy');
    expect(mockPush).toHaveBeenCalledWith(`/route/${route.id}`);
    expect(alert).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('GPX hors de vos zones')).toBeNull();
  });

  it('keeps the track, the altitudes, the distance and 10 km/h', async () => {
    chooseGpx(gpxText('Rando', IN_NANCY));
    await open();
    await importFile();
    const [summary] = await saved();
    const route = await getRoute(db, summary.id);
    if (!route || !route.readable || route.origin !== 'gpx') {
      throw new Error('no GPX route');
    }
    expect(route.track).toHaveLength(2);
    expect(route.elevations).toEqual([200, 250]);
    expect(route.distanceKm).toBeCloseTo(trackLengthM(route.track) / 1000, 6);
    expect(route.durationS).toBe(Math.round((route.distanceKm / 10) * 3600));
    expect(route.zone).toEqual({ id: 'nancy', version: 5, name: 'Nancy' });
    expect(route.ascentM).toBeNull();
  });

  it('takes the name of the file when the GPX has none', async () => {
    chooseGpx(
      '<gpx version="1.1"><trk><trkseg><trkpt lat="48.69" lon="6.18"/><trkpt lat="48.7" lon="6.19"/></trkseg></trk></gpx>',
      'Sortie du dimanche.gpx',
    );
    await open();
    await importFile();
    expect((await saved())[0].name).toBe('Sortie du dimanche');
  });

  it('takes the default name when the file has none either', async () => {
    chooseGpx(
      '<gpx version="1.1"><trk><trkseg><trkpt lat="48.69" lon="6.18"/><trkpt lat="48.7" lon="6.19"/></trkseg></trk></gpx>',
      '.gpx',
    );
    await open();
    await importFile();
    expect((await saved())[0].name).toMatch(/^Itinéraire du \d+ /);
  });

  it('appears in the list at once', async () => {
    chooseGpx(gpxText('Nouvelle', IN_NANCY));
    await open();
    await importFile();
    expect(screen.getByText('Nouvelle')).toBeTruthy();
  });
});

describe('the reading in progress', () => {
  it('turns the button into "Lecture du fichier…" after half a second', async () => {
    let release: (text: string) => void = () => undefined;
    const text = gpxText('Lente', IN_NANCY);
    mockFiles[URI] = { size: text.length };
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: URI, name: 'x.gpx', size: text.length }],
    });
    const files = jest.requireMock('expo-file-system') as {
      File: { prototype: { text: () => Promise<string> } };
    };
    jest
      .spyOn(files.File.prototype, 'text')
      .mockImplementation(
        () => new Promise<string>((resolve) => (release = resolve)),
      );
    await open();
    await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
    expect(screen.queryByText('Lecture du fichier…')).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(screen.getByText('Lecture du fichier…')).toBeTruthy();
    expect(
      screen.getByLabelText('Importer un fichier GPX').props.accessibilityState,
    ).toEqual({ disabled: true });
    await act(async () => release(text));
    await settle();
    expect(screen.getByText('Importer un GPX')).toBeTruthy();
    expect(await saved()).toHaveLength(1);
  });
});

describe('the delay of "Lecture du fichier…"', () => {
  it('does not count the time spent in the picker', async () => {
    const text = gpxText('Rapide', IN_NANCY);
    mockFiles[URI] = { size: text.length, text };
    mockPicker.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                canceled: false,
                assets: [{ uri: URI, name: 'x.gpx', size: text.length }],
              }),
            600,
          ),
        ),
    );
    await open();
    await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });
    expect(screen.queryByText('Lecture du fichier…')).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    await settle();
    expect(screen.queryByText('Lecture du fichier…')).toBeNull();
    expect(await saved()).toHaveLength(1);
  });
});

describe('the announcement for a screen reader', () => {
  it('says the name kept, with a full stop, even a default name', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    chooseGpx(gpxText('Rando', IN_NANCY));
    await open();
    await importFile();
    expect(announce).toHaveBeenLastCalledWith('GPX importé\u00A0: Rando.');
    chooseGpx(
      '<gpx version="1.1"><trk><trkseg><trkpt lat="48.69" lon="6.18"/><trkpt lat="48.7" lon="6.19"/></trkseg></trk></gpx>',
      '.gpx',
    );
    await importFile();
    expect(announce.mock.calls.at(-1)![0]).toMatch(
      /^GPX importé\u00A0: Itinéraire du \d+ .*\.$/,
    );
  });
});

describe('a GPX whose name is only control characters', () => {
  it('is imported under the name of the file', async () => {
    chooseGpx(gpxText('&#1;', IN_NANCY), 'Mon tour.gpx');
    await open();
    await importFile();
    expect((await saved())[0].name).toBe('Mon tour');
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('a GPX outside every zone (state 6c)', () => {
  it('is accepted, with the sheet before the Infos screen', async () => {
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    chooseGpx(gpxText('Traversée Metz – Gorze', IN_METZ));
    await open();
    await importFile();
    const [route] = await saved();
    expect(route.zoneId).toBeNull();
    expect(route.name).toBe('Traversée Metz – Gorze');
    expect(screen.getByText('GPX hors de vos zones')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('variant: offers the zone of the catalogue in memory, with its size', async () => {
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    chooseGpx(gpxText('Metz', IN_METZ));
    await open();
    await importFile();
    expect(
      screen.getByTestId('outside-text').props.children.join(''),
    ).toContain('Ce tracé est dans la zone Metz, pas encore sur le téléphone.');
    expect(screen.getByText('Télécharger Metz · 95 Mo')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('"Télécharger" starts the download and opens the Zones tab', async () => {
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    chooseGpx(gpxText('Metz', IN_METZ));
    await open();
    await importFile();
    await fireEvent.press(screen.getByTestId('outside-download'));
    expect(onDownloadZone).toHaveBeenCalledWith(METZ);
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
    expect(screen.queryByText('GPX hors de vos zones')).toBeNull();
  });

  it('"Plus tard" closes the sheet and opens the Infos screen (6d)', async () => {
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    chooseGpx(gpxText('Metz', IN_METZ));
    await open();
    await importFile();
    await fireEvent.press(screen.getByTestId('outside-later'));
    const [route] = await saved();
    expect(mockPush).toHaveBeenCalledWith(`/route/${route.id}`);
    expect(onDownloadZone).not.toHaveBeenCalled();
    expect(screen.queryByText('GPX hors de vos zones')).toBeNull();
  });

  it('variant A: no zone of the catalogue holds the track', async () => {
    client.setQueryData(catalogueKey, { formatVersion: 1, zones: [NANCY] });
    chooseGpx(gpxText('Loin', IN_METZ));
    await open();
    await importFile();
    expect(
      screen.getByTestId('outside-text').props.children.join(''),
    ).toContain("Ce tracé n'est dans aucune zone de RutaPulse pour l'instant.");
    expect(screen.queryByTestId('outside-download')).toBeNull();
    await fireEvent.press(screen.getByText('Fermer'));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('reads the catalogue once when it is not in memory', async () => {
    const fixture = jest.requireActual(
      '@/core/zones/fixtures/catalogueV3.json',
    );
    const catalogue = {
      ...fixture,
      zones: [
        { ...fixture.zones[0], id: 'metz', name: 'Metz', bbox: METZ.bbox },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(catalogue),
    });
    chooseGpx(gpxText('Metz', IN_METZ));
    await open();
    await importFile();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/^Télécharger Metz · /)).toBeTruthy();
  });

  it('variant B: without network, says so and shows "Voir les zones"', async () => {
    chooseGpx(gpxText('Metz', IN_METZ));
    await open();
    await importFile();
    expect(
      screen.getByTestId('outside-text').props.children.join(''),
    ).toContain(
      'Sans réseau, RutaPulse ne peut pas chercher la zone de ce tracé.',
    );
    expect(screen.queryByTestId('outside-download')).toBeNull();
    expect(await saved()).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('outside-zones'));
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
    expect(screen.queryByText('GPX hors de vos zones')).toBeNull();
  });

  it('variant B: "Plus tard" opens the Infos screen', async () => {
    chooseGpx(gpxText('Metz', IN_METZ));
    await open();
    await importFile();
    await fireEvent.press(screen.getByTestId('outside-later'));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('does not offer a zone that is already on the phone', async () => {
    mockInstalled = [NANCY, METZ];
    client.setQueryData(catalogueKey, {
      formatVersion: 1,
      zones: [NANCY, METZ],
    });
    chooseGpx(gpxText('Metz', IN_METZ));
    await open();
    await importFile();
    expect(screen.queryByTestId('outside-download')).toBeNull();
  });
});
