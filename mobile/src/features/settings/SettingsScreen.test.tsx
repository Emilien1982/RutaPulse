import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { SettingsScreen, settingsTitle } from './SettingsScreen';

// No access to the file system: the settings file is replaced.
jest.mock('@/shared-data/settings/settingsFile', () => ({
  readSettings: () => Promise.resolve({ wifiOnly: true }),
  writeSettings: () => Promise.resolve(),
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
}

describe('SettingsScreen', () => {
  it('shows its French title', async () => {
    await renderScreen();
    expect(screen.getByText('Réglages')).toBeTruthy();
  });

  it('exports the French title', () => {
    expect(settingsTitle).toBe('Réglages');
  });
});
