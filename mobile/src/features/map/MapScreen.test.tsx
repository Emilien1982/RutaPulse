import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapScreen, mapTitle } from './MapScreen';

// Same replacements as MapScreenZone.test.tsx: no native module, no disk.
const mockNavigate = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => ({
  Map: () => null,
  Camera: () => null,
  Layer: () => null,
  UserLocation: () => null,
  useCurrentPosition: () => undefined,
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve({ granted: true }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [] }),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

describe('MapScreen', () => {
  it('shows the empty state of the mockup 91 (no title "Carte")', async () => {
    await render(<MapScreen />);
    expect(screen.getByText('Pas encore de carte')).toBeTruthy();
    expect(
      screen.getByText(
        'Téléchargez une zone pour voir les sentiers, même sans réseau.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Choisir une zone' }),
    ).toBeTruthy();
    expect(screen.queryByText('Carte')).toBeNull();
  });

  it('opens the Zones tab with the button', async () => {
    await render(<MapScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Choisir une zone' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/zones');
  });

  it('exports the French title', () => {
    expect(mapTitle).toBe('Carte');
  });
});
