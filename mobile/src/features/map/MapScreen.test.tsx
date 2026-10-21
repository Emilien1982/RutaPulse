import { render, screen } from '@testing-library/react-native';

import { MapScreen, mapTitle } from './MapScreen';

describe('MapScreen', () => {
  it('shows its French title', async () => {
    await render(<MapScreen />);
    expect(screen.getByText('Carte')).toBeTruthy();
  });

  it('exports the French title', () => {
    expect(mapTitle).toBe('Carte');
  });
});
