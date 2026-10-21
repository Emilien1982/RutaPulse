import { render, screen } from '@testing-library/react-native';

import { RoutesScreen, routesTitle } from './RoutesScreen';

describe('RoutesScreen', () => {
  it('shows its French title', async () => {
    await render(<RoutesScreen />);
    expect(screen.getByText('Itinéraires')).toBeTruthy();
  });

  it('exports the French title', () => {
    expect(routesTitle).toBe('Itinéraires');
  });
});
