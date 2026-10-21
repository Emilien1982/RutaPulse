import { render, screen } from '@testing-library/react-native';

import { MapScreen } from './MapScreen';

describe('MapScreen', () => {
  it('shows its French title', async () => {
    await render(<MapScreen />);
    expect(screen.getByText('Carte')).toBeTruthy();
  });
});
