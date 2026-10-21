import { render, screen } from '@testing-library/react-native';

import { ZonesScreen, zonesTitle } from './ZonesScreen';

describe('ZonesScreen', () => {
  it('shows its French title', async () => {
    await render(<ZonesScreen />);
    expect(screen.getByText('Zones')).toBeTruthy();
  });

  it('exports the French title', () => {
    expect(zonesTitle).toBe('Zones');
  });
});
