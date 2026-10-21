import { render, screen } from '@testing-library/react-native';

import { SettingsScreen, settingsTitle } from './SettingsScreen';

describe('SettingsScreen', () => {
  it('shows its French title', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Réglages')).toBeTruthy();
  });

  it('exports the French title', () => {
    expect(settingsTitle).toBe('Réglages');
  });
});
