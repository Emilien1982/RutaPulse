// The export of a route to a GPX file and the share sheet (ADR 0019, section
// 8; spec C9, C11). The file system, the share sheet and the engine are faked;
// the database is a real SQLite in memory.
import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { readGpx } from '@/core/gpx/readGpx';
import { trackLengthM } from '@/core/gpx/trackLengthM';
import { exportTrackOf } from '@/core/routes/exportGpx';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { getRoute, insertRoute } from '@/core/routes/routeRepo';
import type { CreatedRoute, GpxRoute } from '@/core/routes/savedRoute';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';
import type { Zone } from '@/core/zones/catalogue';

import { exportRoute, useExportRoute } from './exportRoute';

const mockEvents: string[] = [];
const mockWritten: { path: string; text: string }[] = [];
let mockWriteFails = false;
let mockDb: Promise<unknown>;
const mockShare = jest.fn();
const mockHeights = jest.fn();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(base: { uri: string }, name: string) {
      this.uri = `${base.uri}/${name}`;
    }
    get exists() {
      return true;
    }
    delete() {
      mockEvents.push(`delete ${this.uri}`);
    }
    create() {
      mockEvents.push(`mkdir ${this.uri}`);
    }
  }
  class File {
    uri: string;
    constructor(base: { uri: string }, name: string) {
      this.uri = `${base.uri}/${name}`;
    }
    create() {
      mockEvents.push(`create ${this.uri}`);
    }
    write(text: string) {
      if (mockWriteFails) throw new Error('disk full');
      mockWritten.push({ path: this.uri, text });
    }
  }
  return { Directory, File, Paths: { cache: { uri: 'file:///cache' } } };
});
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));
jest.mock('@/shared-data/routing/computeInfos', () => ({
  computePointHeights: (...args: unknown[]) => mockHeights(...args),
}));
jest.mock('./routesDb', () => ({ getRoutesDb: () => mockDb }));

const created = (): CreatedRoute => ({
  ...sampleCreated({ name: 'Boucle: du Bois' }),
  id: 1,
  readable: true,
});
const imported = (): GpxRoute => ({
  ...sampleGpx({ name: 'Sortie importée' }),
  id: 2,
  readable: true,
});
const lastText = () => mockWritten.at(-1)!.text;

beforeEach(() => {
  jest.clearAllMocks();
  mockEvents.length = 0;
  mockWritten.length = 0;
  mockWriteFails = false;
  mockShare.mockResolvedValue(undefined);
  mockHeights.mockImplementation(
    async (shape: unknown[]) =>
      ({ ok: true, heights: shape.map((_p, i) => 300 + i) }) as const,
  );
  global.fetch = jest.fn();
});

describe('exportRoute', () => {
  it('empties the export folder, writes the file, then opens the share sheet', async () => {
    await exportRoute(imported(), false);
    expect(mockEvents).toEqual([
      'delete file:///cache/export',
      'mkdir file:///cache/export',
      'create file:///cache/export/Sortie importée.gpx',
    ]);
    expect(mockWritten).toHaveLength(1);
    expect(mockWritten[0].path).toBe(
      'file:///cache/export/Sortie importée.gpx',
    );
    expect(mockShare).toHaveBeenCalledWith(
      'file:///cache/export/Sortie importée.gpx',
      {
        mimeType: 'application/gpx+xml',
        UTI: 'com.topografix.gpx',
        dialogTitle: 'Sortie importée',
      },
    );
  });

  it('names the file with gpxFileName: forbidden characters become "-"', async () => {
    await exportRoute(created(), false);
    expect(mockWritten[0].path).toBe(
      'file:///cache/export/Boucle- du Bois.gpx',
    );
  });

  it('writes GPX 1.1 with the name and the track, no wpt', async () => {
    await exportRoute(imported(), false);
    expect(lastText()).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(lastText()).toContain('<gpx version="1.1" creator="RutaPulse"');
    expect(lastText()).toContain('<name>Sortie importée</name>');
    expect(lastText()).not.toMatch(/<wpt|<rte/);
    expect(lastText().match(/<trkpt/g)).toHaveLength(3);
  });

  it('an imported GPX keeps its altitudes and never asks the engine', async () => {
    await exportRoute(imported(), true);
    expect(mockHeights).not.toHaveBeenCalled();
    expect(lastText().match(/<ele>/g)).toHaveLength(2);
    expect(lastText()).toContain('<ele>215.5</ele>');
  });

  it('a created route on a usable zone gets one altitude per point', async () => {
    const route = created();
    await exportRoute(route, true);
    const track = exportTrackOf(route);
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(mockHeights).toHaveBeenCalledWith(track);
    expect(lastText().match(/<ele>/g)).toHaveLength(track.length);
    expect(lastText()).toContain('<ele>300</ele>');
  });

  it('a created route without usable zone has no <ele>, and the engine is not asked', async () => {
    await exportRoute(created(), false);
    expect(mockHeights).not.toHaveBeenCalled();
    expect(lastText()).not.toContain('<ele>');
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  it('an engine failure, or a wrong count, gives a file without <ele>', async () => {
    mockHeights.mockResolvedValueOnce({ ok: false, error: 'failed' });
    await exportRoute(created(), true);
    expect(lastText()).not.toContain('<ele>');
    mockHeights.mockResolvedValueOnce({ ok: true, heights: [1, 2] });
    await exportRoute(created(), true);
    expect(lastText()).not.toContain('<ele>');
    expect(mockShare).toHaveBeenCalledTimes(2);
  });

  it('unknown altitudes (null) have no <ele>', async () => {
    mockHeights.mockImplementationOnce(async (shape: unknown[]) => ({
      ok: true,
      heights: shape.map((_p, i) => (i === 0 ? null : 100)),
    }));
    const route = created();
    await exportRoute(route, true);
    expect(lastText().match(/<ele>/g)).toHaveLength(
      exportTrackOf(route).length - 1,
    );
  });

  it('rejects, with no share sheet, when the file cannot be written', async () => {
    mockWriteFails = true;
    await expect(exportRoute(imported(), false)).rejects.toThrow('disk full');
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('never calls the network', async () => {
    await exportRoute(created(), true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['created', created()],
    ['GPX', imported()],
  ])(
    'C11: re-reading the file gives the same track and length (%s)',
    async (_l, route) => {
      await exportRoute(route, true);
      const back = readGpx(lastText());
      if (!back.ok) throw new Error(back.reason);
      const before = exportTrackOf(route);
      expect(back.name).toBe(route.name);
      expect(back.track).toHaveLength(before.length);
      back.track.forEach((point, i) => {
        expect(trackLengthM([point, before[i]])).toBeLessThan(1);
      });
      expect(
        Math.abs(trackLengthM(back.track) - trackLengthM(before)),
      ).toBeLessThan(10);
    },
  );
});

describe('useExportRoute', () => {
  const NANCY = {
    id: 'nancy',
    name: 'Nancy',
    version: 5,
    bbox: { lonMin: 5, lonMax: 7, latMin: 48, latMax: 49 },
    osmDate: '2026-10-01',
    totalBytes: 1,
    files: [],
  } satisfies Zone;
  let db: NodeSqlDb;
  let alert: jest.SpyInstance;

  beforeEach(async () => {
    db = createNodeSqlDb();
    await migrate(db, MIGRATIONS);
    mockDb = Promise.resolve(db);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    db.close();
  });

  async function exportById(
    id: number,
    inService: Zone | null,
    installed: Zone[],
  ) {
    const { result } = await renderHook(() =>
      useExportRoute(inService, installed),
    );
    await act(async () => result.current(id));
  }

  it('exports a saved route, with altitudes when its zone is in service', async () => {
    const id = await insertRoute(db, sampleCreated());
    await exportById(id, NANCY, [NANCY]);
    expect(mockHeights).toHaveBeenCalledTimes(1);
    expect(lastText()).toContain('<ele>');
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it.each([
    ['deleted', null, []],
    ['not in service', { ...NANCY, id: 'metz', name: 'Metz' }, [NANCY]],
  ])(
    'exports a route whose zone is %s, without altitudes',
    async (_l, inService, installed) => {
      const id = await insertRoute(db, sampleCreated());
      await exportById(
        id,
        inService as Zone | null,
        installed.length ? [NANCY, inService as Zone] : [],
      );
      expect(mockHeights).not.toHaveBeenCalled();
      expect(lastText()).not.toContain('<ele>');
      expect(mockShare).toHaveBeenCalledTimes(1);
      expect(alert).not.toHaveBeenCalled();
    },
  );

  it('exports an imported GPX outside every zone', async () => {
    const id = await insertRoute(db, sampleGpx());
    expect((await getRoute(db, id))?.origin).toBe('gpx');
    await exportById(id, null, []);
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(lastText().match(/<ele>/g)).toHaveLength(2);
  });

  it('shows "Export impossible" when the file cannot be written', async () => {
    const id = await insertRoute(db, sampleGpx());
    mockWriteFails = true;
    await exportById(id, null, []);
    expect(alert).toHaveBeenCalledWith(
      'Export impossible',
      "Le fichier GPX n'a pas pu être écrit. Réessayez.",
    );
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('shows "Export impossible" for a route that no longer exists', async () => {
    await exportById(99, null, []);
    expect(alert).toHaveBeenCalledWith(
      'Export impossible',
      "Le fichier GPX n'a pas pu être écrit. Réessayez.",
    );
  });
});
