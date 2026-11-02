// C11, app killed between `.ready.json` of v4 and the erasing of v3: at launch
// v4 is in service (the engine never opens v3), then v3 is erased, after the
// promise of setZone. Written by the tester from the spec and ADR 0018.
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

function Harness() {
  useRoutingEngine();
  return <MapScreen />;
}

it('both versions ready at launch: v4 in service first, v3 erased only after setZone is kept', async () => {
  mockPhone = createFakePhone();
  const remove = mockPhone.ops.remove;
  mockPhone.ops.remove = async (path) => {
    mockEvents.push(`remove ${path}`);
    await remove(path);
  };
  for (const [zone, text] of [
    [v3, 'AAAA'],
    [v4, 'AAAAA'],
  ] as const) {
    mockPhone.files.set(
      readyPath(zone),
      serializeReady(zone, '2026-10-25T10:00:00Z'),
    );
    mockPhone.files.set(filePath(zone, { path: 'a.bin' }), text);
  }
  const tree = () => (
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
  let release = () => {};
  mockGate = new Promise<void>((resolve) => (release = resolve));
  // Like the app: the disk is not read yet at the first render.
  mockInstalled = undefined;
  const view = await render(tree());
  // The clock of v3 is later than the one of v4: the version still wins.
  mockInstalled = [
    marker(v3, '2026-12-01T00:00:00Z'),
    marker(v4, '2026-11-02T10:00:00Z'),
  ];
  await view.rerender(tree());
  expect(zoneService.current()?.version).toBe(4);
  expect(screen.getByText('map v4')).toBeTruthy();
  // The engine is asked for v4 only; v3 is never opened.
  expect(mockEvents).toEqual(['setZone v4']);
  await act(async () => mockPhone.advance(5_000));
  expect(mockPhone.files.get('zones/nancy/v3/a.bin')).toBe('AAAA');

  release();
  await act(async () => mockPhone.advance(10));
  expect(mockEvents).toEqual([
    'setZone v4',
    'setZone v4 kept',
    'remove zones/nancy/v3',
  ]);
  expect(mockPhone.files.has(readyPath(v3))).toBe(false);
  expect(mockPhone.files.has(readyPath(v4))).toBe(true);
});
