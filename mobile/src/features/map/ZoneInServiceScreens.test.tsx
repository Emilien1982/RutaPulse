// MapScreen and DraftSession read the zone in service, not the disk list
// (ADR 0018, section 4).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { makeZone } from '@/core/zones/fakeZoneOps';
import type { Zone } from '@/core/zones/catalogue';
import type { ReadyMarker } from '@/core/zones/zoneLayout';
import { zoneService } from '@/shared-data/zones/zoneInService';

import { DraftSession, useDraftSession } from './DraftSession';
import { MapScreen } from './MapScreen';

let mockInstalled: ReadyMarker[] | undefined;
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
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

const v3 = makeZone({ 'a.bin': 'AAAA' }, 'nancy', 3);
const v4 = makeZone({ 'a.bin': 'AAAAA' }, 'nancy', 4);
const marker = (zone: Zone): ReadyMarker => ({
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00Z',
  zone,
});

// The service is shared by the whole file: the tests run in order, and the
// DraftSession test starts with v4 in service (left by the MapScreen test).
function Points() {
  const session = useDraftSession();
  const [points, setPoints] = useState(0);
  return (
    <>
      <Text>{`draft v${session.zone.version}, ${points} points`}</Text>
      <Pressable
        accessibilityLabel="add"
        onPress={() => setPoints((n) => n + 1)}
      />
    </>
  );
}

describe('MapScreen', () => {
  it('draws nothing before the disk is read', async () => {
    mockInstalled = undefined;
    await render(<MapScreen />);
    expect(screen.queryByText(/map v/)).toBeNull();
  });

  it('follows the zone in service, v3 then v4', async () => {
    mockInstalled = [marker(v3)];
    const view = await render(<MapScreen />);
    expect(screen.getByText('map v3')).toBeTruthy();

    mockInstalled = [marker(v3), marker(v4)];
    await view.rerender(<MapScreen />);
    expect(screen.getByText('map v4')).toBeTruthy();
  });
});

describe('DraftSession', () => {
  it('a v5 arriving during the draft changes neither zone nor points; closing passes to it', async () => {
    const v5 = makeZone({ 'a.bin': 'AAAAAA' }, 'nancy', 5);
    mockInstalled = [marker(v3), marker(v4)];
    const tree = () => (
      <DraftSession>
        <Points />
      </DraftSession>
    );
    const view = await render(tree());
    expect(screen.getByText('draft v4, 0 points')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('add'));
    expect(screen.getByText('draft v4, 1 points')).toBeTruthy();

    mockInstalled = [marker(v3), marker(v4), marker(v5)];
    await view.rerender(tree());
    expect(zoneService.current()?.version).toBe(4);
    expect(screen.getByText('draft v4, 1 points')).toBeTruthy();

    await act(async () => view.unmount());
    expect(zoneService.current()?.version).toBe(5);
  });
});
