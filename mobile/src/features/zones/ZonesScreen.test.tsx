import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { ZonesScreen, zonesTitle } from './ZonesScreen';

// No network and no native module: the catalogue, the file system and the
// downloader are replaced.
jest.mock('./zoneDownloader', () => ({
  ...jest.requireActual('./zoneDownloader'),
  getZoneDownloader: () => ({}),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [] }),
}));
jest.mock('@/shared-data/settings/settingsFile', () => ({
  readSettings: () => Promise.resolve({ wifiOnly: true }),
  writeSettings: () => Promise.resolve(),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({
    availableSpace: () => Promise.resolve(1_000_000_000),
  }),
}));

beforeEach(() => {
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new Error('offline')),
  ) as typeof fetch;
});

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

describe('ZonesScreen', () => {
  it('shows the title of the mockup 41', async () => {
    await renderScreen();
    expect(screen.getByText('Zones hors ligne')).toBeTruthy();
  });

  it('exports the French tab title', () => {
    expect(zonesTitle).toBe('Zones');
  });
});
