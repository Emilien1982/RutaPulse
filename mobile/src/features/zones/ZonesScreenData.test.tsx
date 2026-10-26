import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import catalogueV3 from '@/core/zones/fixtures/catalogueV3.json';
import type { DownloadEntry } from '@/core/zones/zoneRow';
import { LOCAL_FORMAT } from '@/core/zones/zoneLayout';
import { parseCatalogue } from '@/core/zones/catalogue';

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

const mockSetWifiOnly = jest.fn();
let mockWifiOnly = true;
jest.mock('@/shared-data/settings/useSettings', () => ({
  useSettings: () => ({ data: { wifiOnly: mockWifiOnly } }),
  useSetWifiOnly: () => ({ mutate: mockSetWifiOnly }),
}));

jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({
    availableSpace: () => Promise.resolve(23_400_000_000),
  }),
}));

const zone = parseCatalogue(catalogueV3).zones[0];

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ZonesScreen />
    </QueryClientProvider>,
  );
}

function fakeCatalogue(response: Partial<Response> | Error) {
  globalThis.fetch = jest.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response as Response),
  ) as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled.data = [];
  mockWifiOnly = true;
  zoneDownloads.setState(() => ({}));
  fakeCatalogue({ ok: true, json: () => Promise.resolve(catalogueV3) });
});

describe('ZonesScreen, with a fake catalogue', () => {
  it('reads the published catalogue and lists its zones (C1)', async () => {
    await renderScreen();
    expect(await screen.findByText('Nancy')).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json',
    );
    expect(screen.getByText('111 Mo · carte du 22 oct.')).toBeTruthy();
  });

  it('asks the downloader for the zone when "Télécharger" is pressed', async () => {
    await renderScreen();
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Télécharger la zone Nancy (111 Mo)',
      }),
    );
    expect(mockDownloader.request).toHaveBeenCalledWith(zone);
  });

  it('shows the progress of the store, then the cross cancels', async () => {
    await renderScreen();
    await screen.findByText('Nancy');
    const entry: DownloadEntry = {
      zone,
      state: {
        kind: 'downloading',
        doneBytes: 40_000_000,
        totalBytes: zone.totalBytes,
      },
    };
    await act(() => zoneDownloads.setState(() => ({ nancy: entry })));
    expect(screen.getByText('40 Mo sur 111')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Annuler le téléchargement de Nancy',
      }),
    );
    expect(mockDownloader.cancel).toHaveBeenCalledWith('nancy');
  });

  it('shows the banner without Wi-Fi, and its switch writes the setting (C4)', async () => {
    await renderScreen();
    await screen.findByText('Nancy');
    const entry: DownloadEntry = {
      zone,
      state: {
        kind: 'waiting',
        reason: 'no-wifi',
        doneBytes: 0,
        totalBytes: zone.totalBytes,
      },
    };
    await act(() => zoneDownloads.setState(() => ({ nancy: entry })));
    expect(screen.getByText('Pas de Wi-Fi :')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('switch', { name: 'Télécharger en Wi-Fi seulement' }),
    );
    expect(mockSetWifiOnly).toHaveBeenCalledWith(false);
  });

  it('retries after a failure', async () => {
    await renderScreen();
    await screen.findByText('Nancy');
    const entry: DownloadEntry = {
      zone,
      state: {
        kind: 'failed',
        failedPath: 'x',
        doneBytes: 0,
        totalBytes: zone.totalBytes,
      },
    };
    await act(() => zoneDownloads.setState(() => ({ nancy: entry })));
    await fireEvent.press(screen.getByRole('button', { name: /Réessayer/ }));
    expect(mockDownloader.retry).toHaveBeenCalledWith('nancy');
  });

  it('lists an installed zone as ready, and deletes it after a confirmation (C5)', async () => {
    mockInstalled.data = [
      { localFormat: LOCAL_FORMAT, installedAt: '2026-10-24T10:12:31Z', zone },
    ];
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    expect(await screen.findByText('Prête sans réseau')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Actions de la zone Nancy : supprimer',
      }),
    );
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockDownloader.remove).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find((b) => b.text === 'Supprimer')?.onPress?.();
    expect(mockDownloader.remove).toHaveBeenCalledWith('nancy');
  });

  it('shows an error when the catalogue is unreachable, and reads it again', async () => {
    fakeCatalogue(new Error('offline'));
    await renderScreen();
    expect(
      await screen.findByText('Le catalogue des zones est injoignable.'),
    ).toBeTruthy();

    fakeCatalogue({ ok: true, json: () => Promise.resolve(catalogueV3) });
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Nancy')).toBeTruthy();
  });

  it('shows an error when the catalogue answers with an HTTP error', async () => {
    fakeCatalogue({ ok: false, status: 404 });
    await renderScreen();
    expect(
      await screen.findByText('Le catalogue des zones est injoignable.'),
    ).toBeTruthy();
  });

  it('shows an error when the catalogue is not valid', async () => {
    fakeCatalogue({
      ok: true,
      json: () => Promise.resolve({ formatVersion: 2 }),
    });
    await renderScreen();
    expect(
      await screen.findByText('Le catalogue des zones est injoignable.'),
    ).toBeTruthy();
  });
});
