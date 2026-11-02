// C11, a creation is open (hold, choice 3 of the pilotage): the zone stays v3
// for the engine, the map and the creation; nothing is erased; the points of
// the draft stay. On close: passage to v4, then erasing of v3.
// Written by the tester from the spec (C11) and ADR 0018, section 4.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useSelector } from '@tanstack/react-store';
import { useRef } from 'react';
import { Pressable, Text } from 'react-native';

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
import { DraftSession, useDraftSession } from './DraftSession';
import { MapScreen } from './MapScreen';
import { zoneService } from '@/shared-data/zones/zoneInService';

import { useRoutingEngine } from '@/shared-data/routing/useRoutingEngine';

const mockEvents: string[] = [];
let mockPhone: FakePhone;
let mockInstalled: ReadyMarker[] | undefined;

jest.mock('@/shared-data/routing/routingEngine', () => ({
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

/** The creation: shows its zone and its points; "add" places the next one. */
const NEXT = [
  [6.1, 48.6],
  [6.2, 48.7],
  [6.3, 48.8],
];
function Creation() {
  const session = useDraftSession();
  const count = useRef(0);
  const points = useSelector(session.store, (s) => s.draft.points);
  const list = points.map((p) => `${p.lon},${p.lat}`).join(' ');
  return (
    <>
      <Text>{`creation v${session.zone.version} [${list}]`}</Text>
      <Pressable
        accessibilityLabel="add"
        onPress={() => {
          const [lon, lat] = NEXT[count.current++];
          session.dispatch({ type: 'add', lon, lat });
        }}
      />
    </>
  );
}

function Harness({ creationOpen }: { creationOpen: boolean }) {
  useRoutingEngine();
  return (
    <>
      <MapScreen />
      {creationOpen && (
        <DraftSession>
          <Creation />
        </DraftSession>
      )}
    </>
  );
}
const tree = (creationOpen: boolean) => (
  <QueryClientProvider client={client}>
    <Harness creationOpen={creationOpen} />
  </QueryClientProvider>
);

it('v4 arrives during a creation: everything stays on v3, points kept, nothing erased; at close, v4 then erasing', async () => {
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

  mockInstalled = [marker(v3, '2026-10-25T10:00:00Z')];
  const view = await render(tree(false));
  await act(async () => mockPhone.flush());
  expect(screen.getByText('map v3')).toBeTruthy();

  // The creation opens on v3 and the user places two points.
  await view.rerender(tree(true));
  await act(async () => mockPhone.flush());
  expect(screen.getByText('creation v3 []')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('add'));
  await fireEvent.press(screen.getByLabelText('add'));
  expect(screen.getByText('creation v3 [6.1,48.6 6.2,48.7]')).toBeTruthy();
  mockEvents.length = 0;

  // v4 becomes ready while the creation is open.
  mockInstalled = [
    marker(v3, '2026-10-25T10:00:00Z'),
    marker(v4, '2026-11-02T10:00:00Z'),
  ];
  await view.rerender(tree(true));
  await act(async () => mockPhone.advance(5_000));

  expect(zoneService.current()?.version).toBe(3);
  expect(screen.getByText('map v3')).toBeTruthy();
  expect(screen.getByText('creation v3 [6.1,48.6 6.2,48.7]')).toBeTruthy();
  // The engine was not asked to change, and nothing was erased.
  expect(mockEvents).toEqual([]);
  expect(mockPhone.files.get('zones/nancy/v3/a.bin')).toBe('AAAA');
  expect(mockPhone.files.has(readyPath(v3))).toBe(true);

  // A point added now still goes to the v3 draft.
  await fireEvent.press(screen.getByLabelText('add'));
  expect(
    screen.getByText('creation v3 [6.1,48.6 6.2,48.7 6.3,48.8]'),
  ).toBeTruthy();

  // The creation closes: v4 takes over, then v3 is erased.
  await view.rerender(tree(false));
  await act(async () => mockPhone.advance(100));
  expect(zoneService.current()?.version).toBe(4);
  expect(screen.getByText('map v4')).toBeTruthy();
  expect(mockEvents).toEqual(['setZone v4', 'remove zones/nancy/v3']);
  expect([...mockPhone.files.keys()].some((k) => k.includes('/v3'))).toBe(
    false,
  );
  expect(mockPhone.files.has(readyPath(v4))).toBe(true);
});
