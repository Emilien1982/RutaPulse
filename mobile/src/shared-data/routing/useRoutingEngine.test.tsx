// The engine follows the zone in service; the old version is erased after
// the engine has left it (ADR 0018, section 4).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createFakePhone, makeZone } from '@/core/zones/fakeZoneOps';
import type { Zone } from '@/core/zones/catalogue';
import {
  readyPath,
  serializeReady,
  type ReadyMarker,
} from '@/core/zones/zoneLayout';

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

const v3 = makeZone({ 'a.bin': 'AAAA' }, 'nancy', 3);
const v4 = makeZone({ 'a.bin': 'AAAAA' }, 'nancy', 4);
const marker = (zone: Zone): ReadyMarker => ({
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00Z',
  zone,
});

it('opens v3, then v4, and erases v3 only after setZone(v4)', async () => {
  for (const zone of [v3, v4]) {
    mockPhone.files.set(
      readyPath(zone),
      serializeReady(zone, '2026-10-25T10:00:00Z'),
    );
    mockPhone.files.set(`zones/nancy/v${zone.version}/a.bin`, 'A');
  }
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  mockInstalled = [marker(v3)];
  const { rerender } = await renderHook(() => useRoutingEngine(), { wrapper });
  await act(async () => mockPhone.flush());
  expect(mockEvents).toEqual(['setZone v3']);
  expect(mockPhone.files.has('zones/nancy/v3/a.bin')).toBe(true);

  mockInstalled = [marker(v3), marker(v4)];
  await rerender({});
  await act(async () => mockPhone.flush());

  expect(mockEvents).toEqual(['setZone v3', 'setZone v4']);
  expect([...mockPhone.files.keys()].some((k) => k.includes('/v3/'))).toBe(
    false,
  );
  expect(mockPhone.files.has('zones/nancy/v4/a.bin')).toBe(true);
});
