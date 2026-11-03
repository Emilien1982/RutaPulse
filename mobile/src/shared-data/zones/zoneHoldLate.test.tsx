// A hold taken before the disk is read waits for the first zone.
import { act, renderHook } from '@testing-library/react-native';

import { makeZone } from '@/core/zones/fakeZoneOps';
import type { Zone } from '@/core/zones/catalogue';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { useZoneHold, zoneService } from './zoneInService';

let mockInstalled: ReadyMarker[] | undefined;
jest.mock('./useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));

const v3 = makeZone({ 'a.bin': 'AAAA' }, 'nancy', 3);
const v4 = makeZone({ 'a.bin': 'AAAAA' }, 'nancy', 4);
const marker = (zone: Zone): ReadyMarker => ({
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00Z',
  zone,
});

it('holds the first zone known after the mount, then keeps it', async () => {
  mockInstalled = undefined;
  const { result, rerender, unmount } = await renderHook(() => useZoneHold());
  expect(result.current).toBeUndefined();

  mockInstalled = [marker(v3)];
  await rerender({});
  expect(result.current?.version).toBe(3);

  mockInstalled = [marker(v3), marker(v4)];
  await rerender({});
  expect(result.current?.version).toBe(3);
  expect(zoneService.current()?.version).toBe(3);

  await act(async () => unmount());
  expect(zoneService.current()?.version).toBe(4);
});
