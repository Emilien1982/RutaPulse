// Tests of the Zones screen for an update (phase 5b, T4): C9 and the exact
// texts of the note of the mockup 41 (design/v1/41-zones.html, screens 2 to 4,
// variants A to C). Only the edges are faked: catalogue (fetch), disk list,
// downloader.
//
// External source of the numbers: the catalogue published at
// https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json
// read on 2 November 2026: nancy v3 (110962386 bytes = "111 Mo", osmDate
// 2026-10-22 = "22 oct.") and nancy v4 (111360850 bytes = "111 Mo", osmDate
// 2026-11-01T21:21:36Z = "1 nov.").
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

import { parseCatalogue, type Zone } from '@/core/zones/catalogue';
import catalogueV3 from '@/core/zones/fixtures/catalogueV3.json';
import catalogueV4 from '@/core/zones/fixtures/catalogueV4Testeur.json';
import type { DownloadEntry } from '@/core/zones/zoneRow';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { zoneDownloads } from './zoneDownloader';
import { ZonesScreen } from './ZonesScreen';

const mockDownloader = {
  request: jest.fn(() => Promise.resolve()),
  retry: jest.fn(),
  cancel: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
  resumeInterrupted: jest.fn(() => Promise.resolve()),
};
jest.mock('./zoneDownloader', () => ({
  ...jest.requireActual('./zoneDownloader'),
  getZoneDownloader: () => mockDownloader,
}));
const mockInstalled: { data: unknown[] } = { data: [] };
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => mockInstalled,
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({
    availableSpace: () => Promise.resolve(23_400_000_000),
  }),
}));
jest.mock('@/shared-data/settings/settingsFile', () => ({
  readSettings: () => Promise.resolve({ wifiOnly: true }),
  writeSettings: () => Promise.resolve(),
}));

const v3 = parseCatalogue(catalogueV3).zones[0];
const v4 = parseCatalogue(catalogueV4).zones[0];
const marker = (zone: Zone): ReadyMarker => ({
  localFormat: 1,
  installedAt: '2026-10-24T10:12:31Z',
  zone,
});
const NB = ' ';

function catalogue(...zones: Zone[]) {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ formatVersion: 1, zones }),
    }),
  ) as unknown as typeof fetch;
}

function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ZonesScreen />
    </QueryClientProvider>,
  );
}

const running = (state: DownloadEntry['state']) =>
  act(() => {
    zoneDownloads.setState(() => ({ nancy: { zone: v4, state } }));
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled.data = [marker(v3)];
  zoneDownloads.setState(() => ({}));
  catalogue(v4);
});

describe('screen 2, update available', () => {
  it('shows the top of the v3 card, then the offer with the date of the map', async () => {
    await show();
    expect(await screen.findByText('Mise à jour disponible')).toBeTruthy();
    expect(screen.getByText('111 Mo · carte du 22 oct.')).toBeTruthy();
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();
    expect(screen.getByText('111 Mo · carte du 1 nov.')).toBeTruthy();
    expect(
      screen.getByLabelText('Mettre à jour la zone Nancy (111 Mo)'),
    ).toBeTruthy();
    // Nancy is not offered as a download: it is already on the phone.
    expect(screen.queryByText('Télécharger')).toBeNull();
  });

  it('nothing starts by itself; only the touch starts the update, once', async () => {
    await show();
    await screen.findByText('Mise à jour disponible');
    expect(mockDownloader.request).not.toHaveBeenCalled();
    expect(mockDownloader.retry).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Mettre à jour'));
    expect(mockDownloader.request).toHaveBeenCalledTimes(1);
    expect(mockDownloader.request).toHaveBeenCalledWith(v4);
  });

  it('no catalogue (offline): the card is the one of screen 1', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('offline')),
    ) as typeof fetch;
    await show();
    await screen.findByText('Prête sans réseau');
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText('Mise à jour disponible')).toBeNull();
    expect(screen.queryByText('Mettre à jour')).toBeNull();
  });

  it.each([
    ['the same version', v3],
    ['an older version', { ...v3, version: 2 }],
  ])('catalogue with %s: no offer', async (_name, zone) => {
    catalogue(zone);
    await show();
    await screen.findByText('Prête sans réseau');
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText('Mise à jour disponible')).toBeNull();
  });

  it('same map date: the size alone, and the title "Mise à jour" without date', async () => {
    const bigger = 120_000_000 - v3.totalBytes;
    const files = v3.files.map((f, i) =>
      i === 0 ? { ...f, bytes: f.bytes + bigger } : f,
    );
    const same: Zone = {
      ...v4,
      files,
      osmDate: v3.osmDate,
      totalBytes: 120_000_000,
    };
    catalogue(same);
    await show();
    expect(await screen.findByText('120 Mo')).toBeTruthy();
    expect(screen.queryByText(/120 Mo ·/)).toBeNull();

    await act(() => {
      zoneDownloads.setState(() => ({
        nancy: {
          zone: same,
          state: {
            kind: 'downloading',
            doneBytes: 1_000_000,
            totalBytes: same.totalBytes,
          },
        },
      }));
    });
    expect(await screen.findByText('Mise à jour')).toBeTruthy();
    expect(screen.queryByText(/Mise à jour :/)).toBeNull();
  });
});

describe('screen 3, update running', () => {
  it('title with the date, progress, the sentence "La zone reste utilisable…", the cross', async () => {
    await show();
    await running({
      kind: 'downloading',
      doneBytes: 47_000_000,
      totalBytes: v4.totalBytes,
    });
    expect(
      await screen.findByText(`Mise à jour${NB}: carte du 1 nov.`),
    ).toBeTruthy();
    expect(screen.getByText('47 Mo sur 111')).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable pendant la mise à jour.'),
    ).toBeTruthy();
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();
    expect(screen.queryByText('Mettre à jour')).toBeNull();

    // The cross cancels at once, without a confirmation.
    const alert = jest.spyOn(Alert, 'alert');
    fireEvent.press(screen.getByLabelText('Annuler la mise à jour de Nancy'));
    expect(mockDownloader.cancel).toHaveBeenCalledWith('nancy');
    expect(alert).not.toHaveBeenCalled();
  });

  it('waiting for its turn, for the network', async () => {
    await show();
    await running({ kind: 'queued' });
    expect(await screen.findByText('En attente de son tour')).toBeTruthy();
    await running({
      kind: 'waiting',
      reason: 'no-network',
      doneBytes: 1_000_000,
      totalBytes: v4.totalBytes,
    });
    expect(
      await screen.findByText('En attente du réseau · 1 Mo sur 111'),
    ).toBeTruthy();
  });
});

describe('screen 4, update asked without Wi-Fi', () => {
  it('waiting text, the banner and its switch, the sentence', async () => {
    await show();
    await running({
      kind: 'waiting',
      reason: 'no-wifi',
      doneBytes: 0,
      totalBytes: v4.totalBytes,
    });
    expect(
      await screen.findByText('En attente du Wi-Fi · 0 Mo sur 111'),
    ).toBeTruthy();
    expect(screen.getByText(`Pas de Wi-Fi${NB}:`)).toBeTruthy();
    expect(
      screen.getByText(/les téléchargements attendent le Wi-Fi\./),
    ).toBeTruthy();
    expect(screen.getByText('Télécharger en Wi-Fi seulement')).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable pendant la mise à jour.'),
    ).toBeTruthy();
  });
});

describe('variants A and B, failure and lack of room', () => {
  it('A, failure: red line, the old date, "Réessayer la mise à jour de Nancy"', async () => {
    await show();
    await running({
      kind: 'failed',
      failedPath: 'map.pmtiles',
      doneBytes: 47_000_000,
      totalBytes: v4.totalBytes,
    });
    expect(
      await screen.findByText('Échec de la mise à jour · 47 Mo sur 111'),
    ).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable avec la carte du 22 oct.'),
    ).toBeTruthy();
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Réessayer la mise à jour de Nancy'));
    expect(mockDownloader.retry).toHaveBeenCalledWith('nancy');
  });

  it('B, no room: whole v4 + 50 Mo, the old version not counted as room', async () => {
    await show();
    // 111 360 850 + 50 000 000 = 161 360 850 bytes: "161 Mo"
    await running({
      kind: 'no-space',
      neededBytes: 161_360_850,
      availableBytes: 100_000_000,
    });
    expect(
      await screen.findByText(
        `Place insuffisante${NB}: il faut 161 Mo libres.`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable avec la carte du 22 oct.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Réessayer la mise à jour de Nancy'));
    expect(mockDownloader.retry).toHaveBeenCalledWith('nancy');
  });
});

describe('variant C, update finished', () => {
  it('v4 ready: new size and date, no update part, no message, one card', async () => {
    mockInstalled.data = [marker(v3), marker(v4)];
    await show();
    expect(await screen.findByText('111 Mo · carte du 1 nov.')).toBeTruthy();
    expect(screen.queryByText('111 Mo · carte du 22 oct.')).toBeNull();
    expect(screen.queryByText('Mise à jour disponible')).toBeNull();
    expect(screen.queryByText(/La zone reste utilisable/)).toBeNull();
    expect(screen.queryByText(/Mise à jour/)).toBeNull();
    expect(screen.getAllByText('Prête sans réseau')).toHaveLength(1);
  });
});
