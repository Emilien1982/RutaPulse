// Tests of the T4 screens, written from the spec (C1, C2, C4, C5, C11) and the
// mockups 41 and 80. Only the edges are faked: network, disk, downloader.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

import { parseCatalogue } from '@/core/zones/catalogue';
import catalogueV3 from '@/core/zones/fixtures/catalogueV3.json';
import type { DownloadEntry } from '@/core/zones/zoneRow';
import { LOCAL_FORMAT } from '@/core/zones/zoneLayout';

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

// A settings "file" in memory: the real hooks run on top of it.
const mockFile: { settings: { wifiOnly: boolean } | null } = { settings: null };
jest.mock('@/shared-data/settings/settingsFile', () => ({
  readSettings: () => Promise.resolve(mockFile.settings ?? { wifiOnly: true }),
  writeSettings: (s: { wifiOnly: boolean }) => {
    mockFile.settings = s;
    return Promise.resolve();
  },
}));

const zone = parseCatalogue(catalogueV3).zones[0];

function wrap(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function fakeCatalogue(body: unknown) {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) }),
  ) as unknown as typeof fetch;
}

const noWifiEntry: DownloadEntry = {
  zone,
  state: {
    kind: 'waiting',
    reason: 'no-wifi',
    doneBytes: 40_000_000,
    totalBytes: zone.totalBytes,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled.data = [];
  mockFile.settings = null;
  zoneDownloads.setState(() => ({}));
  fakeCatalogue(catalogueV3);
});

describe('T4 Zones screen, texts of the mockup 41', () => {
  it('shows title, sections and explanation paragraph', async () => {
    mockInstalled.data = [
      { localFormat: LOCAL_FORMAT, installedAt: '2026-10-24T10:12:31Z', zone },
    ];
    await wrap(<ZonesScreen />);
    expect(await screen.findByText('Zones hors ligne')).toBeTruthy();
    expect(screen.getByText('Sur le téléphone')).toBeTruthy();
    expect(screen.getByText('111 Mo')).toBeTruthy();
    expect(screen.getByText('Disponibles')).toBeTruthy();
    expect(await screen.findByText('23,4 Go libres')).toBeTruthy();
    expect(
      screen.getByText(
        "Une zone contient la carte, le calcul d'itinéraire et l'altitude d'un carré d'environ 50 km de côté. Une fois téléchargée, tout marche sans réseau : carte, création et suivi.",
      ),
    ).toBeTruthy();
  });

  it('does not show the section "Sur le téléphone" when nothing is installed', async () => {
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    expect(screen.queryByText('Sur le téléphone')).toBeNull();
  });
});

describe('T4 C1, zones of the catalogue', () => {
  it('lists every zone with name, size and date of the data', async () => {
    const other = {
      ...catalogueV3.zones[0],
      id: 'metz',
      name: 'Metz et vallée de la Moselle',
      files: catalogueV3.zones[0].files.slice(0, 2),
      totalBytes: 2107 + 3809985,
      osmDate: '2026-10-18T03:00:00Z',
    };
    fakeCatalogue({ ...catalogueV3, zones: [...catalogueV3.zones, other] });
    await wrap(<ZonesScreen />);
    expect(await screen.findByText('Nancy')).toBeTruthy();
    expect(screen.getByText('111 Mo · carte du 22 oct.')).toBeTruthy();
    expect(screen.getByText('Metz et vallée de la Moselle')).toBeTruthy();
    expect(screen.getByText('4 Mo · carte du 18 oct.')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Télécharger la zone Metz et vallée de la Moselle (4 Mo)',
      }),
    ).toBeTruthy();
  });

  it('shows an empty catalogue without crashing', async () => {
    fakeCatalogue({ ...catalogueV3, zones: [] });
    await wrap(<ZonesScreen />);
    expect(await screen.findByText('Disponibles')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Télécharger/ })).toBeNull();
  });
});

describe('T4 C2, progress and checked state', () => {
  it('shows the progress bar and the megabytes while downloading', async () => {
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    await act(() =>
      zoneDownloads.setState(() => ({
        nancy: {
          zone,
          state: {
            kind: 'downloading',
            doneBytes: 55_481_193,
            totalBytes: zone.totalBytes,
          },
        },
      })),
    );
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 50 });
    expect(screen.getByText('55 Mo sur 111')).toBeTruthy();
    expect(screen.queryByText('Prête sans réseau')).toBeNull();
  });

  it('does not show a zone as ready when its download failed (bad fingerprint)', async () => {
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    await act(() =>
      zoneDownloads.setState(() => ({
        nancy: {
          zone,
          state: {
            kind: 'failed',
            failedPath: 'map.pmtiles',
            doneBytes: zone.totalBytes,
            totalBytes: zone.totalBytes,
          },
        },
      })),
    );
    expect(screen.queryByText('Prête sans réseau')).toBeNull();
    expect(screen.queryByText('Sur le téléphone')).toBeNull();
    expect(screen.getByText(/Échec du téléchargement/)).toBeTruthy();
  });

  it('moves the zone to "Sur le téléphone" once ready', async () => {
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    await act(() =>
      zoneDownloads.setState(() => ({
        nancy: { zone, state: { kind: 'ready' } as never },
      })),
    );
    expect(screen.getByText('Sur le téléphone')).toBeTruthy();
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();
  });
});

describe('T4 C4, Wi-Fi only', () => {
  it('has no banner while nothing waits for the Wi-Fi', async () => {
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    expect(screen.queryByText('Pas de Wi-Fi :')).toBeNull();
  });

  it('shows the banner, the waiting state and the switch on by default', async () => {
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    await act(() => zoneDownloads.setState(() => ({ nancy: noWifiEntry })));
    expect(screen.getByText('Pas de Wi-Fi :')).toBeTruthy();
    expect(
      screen.getByText(/les téléchargements attendent le Wi-Fi\./),
    ).toBeTruthy();
    expect(
      screen.getByText('En attente du Wi-Fi · 40 Mo sur 111'),
    ).toBeTruthy();
    const toggle = screen.getByRole('switch', {
      name: 'Télécharger en Wi-Fi seulement',
    });
    expect(toggle.props.accessibilityState).toEqual({ checked: true });
  });

  it('the banner switch writes the shared setting file, and back', async () => {
    // The Settings screen reads the same file through the same hooks
    // (a feature cannot import another one, so it is tested on the device).
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    await act(() => zoneDownloads.setState(() => ({ nancy: noWifiEntry })));
    const toggle = () =>
      screen.getByRole('switch', { name: 'Télécharger en Wi-Fi seulement' });

    await fireEvent.press(toggle());
    await waitFor(() =>
      expect(toggle().props.accessibilityState.checked).toBe(false),
    );
    expect(mockFile.settings).toEqual({ wifiOnly: false });

    await fireEvent.press(toggle());
    await waitFor(() =>
      expect(toggle().props.accessibilityState.checked).toBe(true),
    );
    expect(mockFile.settings).toEqual({ wifiOnly: true });
  });

  it('shows a saved "false" in the banner', async () => {
    mockFile.settings = { wifiOnly: false };
    await wrap(<ZonesScreen />);
    await screen.findByText('Nancy');
    await act(() => zoneDownloads.setState(() => ({ nancy: noWifiEntry })));
    await waitFor(() =>
      expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(
        false,
      ),
    );
  });
});

describe('T4 C5, delete with confirmation', () => {
  beforeEach(() => {
    mockInstalled.data = [
      { localFormat: LOCAL_FORMAT, installedAt: '2026-10-24T10:12:31Z', zone },
    ];
  });

  it('asks first, names the zone, and "Garder" deletes nothing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await wrap(<ZonesScreen />);
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Actions de la zone Nancy : supprimer',
      }),
    );
    expect(alert.mock.calls[0][0]).toBe('Supprimer la zone Nancy ?');
    const buttons = alert.mock.calls[0][2] ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['Garder', 'Supprimer']);
    buttons.find((b) => b.text === 'Garder')?.onPress?.();
    expect(mockDownloader.remove).not.toHaveBeenCalled();
  });

  it('"Supprimer" removes the zone by its id', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await wrap(<ZonesScreen />);
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Actions de la zone Nancy : supprimer',
      }),
    );
    alert.mock.calls[0][2]?.find((b) => b.text === 'Supprimer')?.onPress?.();
    expect(mockDownloader.remove).toHaveBeenCalledWith('nancy');
  });
});
