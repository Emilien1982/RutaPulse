// Tests of the Settings screen written from the mockup 80 and the spec (C4).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { SettingsScreen } from './SettingsScreen';

const mockFile: { settings: { wifiOnly: boolean } | null } = { settings: null };
jest.mock('@/shared-data/settings/settingsFile', () => ({
  readSettings: () => Promise.resolve(mockFile.settings ?? { wifiOnly: true }),
  writeSettings: (s: { wifiOnly: boolean }) => {
    mockFile.settings = s;
    return Promise.resolve();
  },
}));

function wrap() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
}

const toggle = () =>
  screen.getByRole('switch', { name: 'Télécharger en Wi-Fi seulement' });

beforeEach(() => {
  mockFile.settings = null;
});

describe('Settings screen, mockup 80 and C4', () => {
  it('shows section, switch and explanation', async () => {
    await wrap();
    expect(screen.getByText('Réglages')).toBeTruthy();
    expect(screen.getByText('Téléchargements')).toBeTruthy();
    expect(screen.getByText('Télécharger en Wi-Fi seulement')).toBeTruthy();
    expect(
      screen.getByText(
        'Sans Wi-Fi, les zones attendent. Une zone pèse environ 100 Mo.',
      ),
    ).toBeTruthy();
  });

  it('is on by default (no settings file)', async () => {
    await wrap();
    expect(toggle().props.accessibilityState.checked).toBe(true);
  });

  it('reads a saved "false"', async () => {
    mockFile.settings = { wifiOnly: false };
    await wrap();
    await waitFor(() =>
      expect(toggle().props.accessibilityState.checked).toBe(false),
    );
  });

  it('writes the setting file when pressed, and shows the new value', async () => {
    await wrap();
    await fireEvent.press(toggle());
    await waitFor(() =>
      expect(toggle().props.accessibilityState.checked).toBe(false),
    );
    expect(mockFile.settings).toEqual({ wifiOnly: false });
  });
});
