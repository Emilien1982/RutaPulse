// Free space after an old version is erased; announce only when in front.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { makeZone } from '@/core/zones/fakeZoneOps';
import type { Zone } from '@/core/zones/catalogue';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { ZonesScreen } from './ZonesScreen';

let mockData: ReadyMarker[] = [];
let mockUpdatedAt = 1;
const mockSpace = jest.fn(() => Promise.resolve(1_000_000_000));

jest.mock('./zoneDownloader', () => ({
  ...jest.requireActual('./zoneDownloader'),
  getZoneDownloader: () => ({}),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockData, dataUpdatedAt: mockUpdatedAt }),
}));
jest.mock('@/shared-data/settings/settingsFile', () => ({
  readSettings: () => Promise.resolve({ wifiOnly: true }),
  writeSettings: () => Promise.resolve(),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => ({ availableSpace: () => mockSpace() }),
}));

const v3 = makeZone({ 'a.bin': 'AAAA' }, 'nancy', 3);
const v4 = makeZone({ 'a.bin': 'AAAAA' }, 'nancy', 4);
const marker = (zone: Zone): ReadyMarker => ({
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00Z',
  zone,
});

function tree(focused: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ZonesScreen focused={focused} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new Error('offline')),
  ) as typeof fetch;
  mockSpace.mockClear();
});

it('reads the free space again after each reading of the disk', async () => {
  mockData = [marker(v3)];
  mockUpdatedAt = 1;
  const client = new QueryClient();
  const ui = () => (
    <QueryClientProvider client={client}>
      <ZonesScreen />
    </QueryClientProvider>
  );
  const view = await render(ui());
  await act(async () => {});
  const before = mockSpace.mock.calls.length;

  // Same installed bytes (the greatest version only), new reading.
  mockUpdatedAt = 2;
  await view.rerender(ui());
  await act(async () => {});
  expect(mockSpace.mock.calls.length).toBe(before + 1);
});

describe('announcement "zone updated"', () => {
  it.each([
    [true, 1],
    [false, 0],
  ])('focused=%s: %i announcement(s)', async (focused, calls) => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    mockData = [marker(v3)];
    const view = await render(tree(focused));
    mockData = [marker(v3), marker(v4)];
    await view.rerender(tree(focused));
    expect(announce).toHaveBeenCalledTimes(calls);
    if (calls) expect(announce).toHaveBeenCalledWith('Zone Nancy mise à jour.');
    announce.mockRestore();
  });
});
