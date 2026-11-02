// C11, no creation open: the zone in service passes to v4, setZone(v4) leaves
// in the same step, and v3 is erased only after the promise of setZone is kept
// (ADR 0018, section 4). The promise is held by hand to prove the order.
// Written by the tester from the spec (C11) and the ADR, not from the code.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';

import type { Zone } from '@/core/zones/catalogue';
import {
  createFakePhone,
  makeZone,
  type FakePhone,
} from '@/core/zones/fakeZoneOps';
import {
  filePath,
  readyPath,
  serializeReady,
  type ReadyMarker,
} from '@/core/zones/zoneLayout';
import { MapScreen } from './MapScreen';
import { zoneService } from '@/shared-data/zones/zoneInService';

import { useRoutingEngine } from '@/shared-data/routing/useRoutingEngine';

const mockEvents: string[] = [];
let mockPhone: FakePhone;
let mockInstalled: ReadyMarker[] | undefined;
let mockGate: Promise<void> = Promise.resolve();

jest.mock('@/shared-data/routing/routingEngine', () => ({
  routingEngine: {
    setZone: (zone: Zone | null) => {
      mockEvents.push(`setZone v${zone?.version}`);
      return mockGate.then(() => {
        mockEvents.push(`setZone v${zone?.version} kept`);
      });
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
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));
jest.mock('./ZoneMap', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    ZoneMap: ({ zone }: { zone: Zone }) => (
      <RNText>{`map v${zone.version}`}</RNText>
    ),
  };
});

const client = new QueryClient();
const v3 = makeZone({ 'a.bin': 'AAAA' }, 'nancy', 3);
const v4 = makeZone({ 'a.bin': 'AAAAA' }, 'nancy', 4);
const marker = (zone: Zone, at: string): ReadyMarker => ({
  localFormat: 1,
  installedAt: at,
  zone,
});

function putOnDisk(zone: Zone, text: string) {
  mockPhone.files.set(
    readyPath(zone),
    serializeReady(zone, '2026-10-25T10:00:00Z'),
  );
  mockPhone.files.set(filePath(zone, { path: 'a.bin' }), text);
}

function Harness() {
  useRoutingEngine();
  return <MapScreen />;
}

const tree = () => (
  <QueryClientProvider client={client}>
    <Harness />
  </QueryClientProvider>
);

it('v4 ready, no creation: service passes at once, v3 erased only after setZone is kept', async () => {
  mockPhone = createFakePhone();
  const remove = mockPhone.ops.remove;
  mockPhone.ops.remove = async (path) => {
    mockEvents.push(`remove ${path}`);
    await remove(path);
  };
  putOnDisk(v3, 'AAAA');
  putOnDisk(v4, 'AAAAA');

  // Launch with v3 alone.
  mockInstalled = [marker(v3, '2026-10-25T10:00:00Z')];
  const view = await render(tree());
  await act(async () => mockPhone.flush());
  expect(zoneService.current()?.version).toBe(3);
  expect(screen.getByText('map v3')).toBeTruthy();
  mockEvents.length = 0;

  // The engine will not answer until we say so.
  let release = () => {};
  mockGate = new Promise<void>((resolve) => (release = resolve));

  // v4 becomes ready (the list of the disk is read again).
  mockInstalled = [
    marker(v3, '2026-10-25T10:00:00Z'),
    marker(v4, '2026-11-02T10:00:00Z'),
  ];
  await view.rerender(tree());

  // Same step: the zone passed and setZone(v4) left. Nothing erased yet.
  expect(zoneService.current()?.version).toBe(4);
  expect(mockEvents).toEqual(['setZone v4']);
  expect(screen.getByText('map v4')).toBeTruthy();

  // Time passes while the engine has not finished: v3 must still be there.
  await act(async () => mockPhone.advance(5_000));
  expect(mockEvents).toEqual(['setZone v4']);
  expect(mockPhone.files.get('zones/nancy/v3/a.bin')).toBe('AAAA');
  expect(mockPhone.files.has(readyPath(v3))).toBe(true);

  // The engine leaves v3: now, and only now, v3 goes.
  release();
  await act(async () => mockPhone.advance(10));
  expect(mockEvents).toEqual([
    'setZone v4',
    'setZone v4 kept',
    'remove zones/nancy/v3',
  ]);
  expect([...mockPhone.files.keys()].some((k) => k.includes('/v3'))).toBe(
    false,
  );
  expect(mockPhone.files.get('zones/nancy/v4/a.bin')).toBe('AAAAA');
  expect(mockPhone.files.has(readyPath(v4))).toBe(true);
});
