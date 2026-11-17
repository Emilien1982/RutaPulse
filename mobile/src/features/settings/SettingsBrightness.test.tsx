// The "Pendant le suivi" section of the Settings screen (mockup v1/80, ADR
// 0021, section 8.5): the choice is the one of the tracking panel, kept in the
// same file, written by merge.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { readSettings } from '@/shared-data/settings/settingsFile';

import { SettingsScreen } from './SettingsScreen';

jest.mock('expo-file-system', () =>
  jest
    .requireActual('../../shared-data/zones/memoryFileSystem')
    .createMemoryFileSystem(),
);

const mem = jest.requireMock('expo-file-system') as {
  files: Map<string, string>;
};

beforeEach(() => mem.files.clear());

function isChosen(name: string) {
  return screen.getByRole('radio', { name }).props.accessibilityState.checked;
}

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

describe('Settings screen, brightness', () => {
  it('shows the section, "Automatique" chosen by default, and the help', async () => {
    await renderScreen();
    expect(screen.getByText('Pendant le suivi')).toBeOnTheScreen();
    expect(screen.getByText("Luminosité de l'écran")).toBeOnTheScreen();
    expect(isChosen('Automatique')).toBe(true);
    expect(isChosen('Maximum')).toBe(false);
    expect(
      screen.getByText(/plus lisible au soleil, mais la batterie baisse/),
    ).toBeOnTheScreen();
    expect(screen.getByText('Se change aussi pendant le suivi.')).toBeTruthy();
  });

  it('keeps "Maximum" and the Wi-Fi setting in the same file', async () => {
    await renderScreen();
    await fireEvent.press(
      screen.getByRole('switch', { name: 'Télécharger en Wi-Fi seulement' }),
    );
    await act(async () => {});
    await fireEvent.press(screen.getByRole('radio', { name: 'Maximum' }));
    await act(async () => {});
    await waitFor(() => expect(isChosen('Maximum')).toBe(true));
    expect(await readSettings()).toEqual({
      wifiOnly: false,
      brightness: 'max',
    });
  });

  it('reads the kept choice, then Wi-Fi only does not clear it', async () => {
    mem.files.set(
      'file:///doc/settings.json',
      '{"wifiOnly":true,"brightness":"max"}',
    );
    await renderScreen();
    await waitFor(() => expect(isChosen('Maximum')).toBe(true));
    await fireEvent.press(
      screen.getByRole('switch', { name: 'Télécharger en Wi-Fi seulement' }),
    );
    await act(async () => {});
    expect(await readSettings()).toEqual({
      wifiOnly: false,
      brightness: 'max',
    });
  });
});
