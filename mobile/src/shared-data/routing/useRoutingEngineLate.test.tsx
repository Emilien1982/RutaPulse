// A zone already given to the service before the hook subscribes must be
// followed too (ADR 0018, section 4). Own file: the zone service is a
// singleton, so this test needs a fresh module registry.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createFakePhone, makeZone } from '@/core/zones/fakeZoneOps';
import type { Zone } from '@/core/zones/catalogue';
import type { ReadyMarker } from '@/core/zones/zoneLayout';
import { zoneService } from '@/shared-data/zones/zoneInService';

import { useRoutingEngine } from './useRoutingEngine';

const mockPhone = createFakePhone();
const mockEvents: string[] = [];
let mockInstalled: ReadyMarker[] | undefined;

jest.mock('./routingEngine', () => ({
  routingEngine: {
    setZone: (zone: Zone | null) => {
      mockEvents.push(`setZone v${zone?.version}`);
      return Promise.resolve();
    },
  },
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  installedZonesQueryKey: ['zones', 'installed'],
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/createZoneOps', () => ({
  createZoneOps: () => mockPhone.ops,
}));

const v4 = makeZone({ 'a.bin': 'AAAAA' }, 'nancy', 4);
const marker = (zone: Zone): ReadyMarker => ({
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00Z',
  zone,
});

it('follows a zone already in service when it subscribes', async () => {
  mockEvents.length = 0;
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  // A child fed the service before the effect of this hook ran.
  mockInstalled = [marker(v4)];
  zoneService.update([marker(v4)]);
  mockEvents.length = 0;
  await renderHook(() => useRoutingEngine(), { wrapper });
  await act(async () => mockPhone.flush());
  expect(mockEvents[0]).toBe('setZone v4');
});
