import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { RoutesScreen, routesTitle } from './RoutesScreen';

// The screen now reads the saved routes and the zones (T5): the router, the
// safe area, the database and the zones are replaced. The detailed tests are
// in RoutesScreenT5.test.tsx.
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => new Promise(() => undefined),
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneInService: () => null,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: [] }),
}));

describe('RoutesScreen', () => {
  it('shows its French title', async () => {
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <RoutesScreen />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Mes itinéraires')).toBeTruthy();
  });

  it('exports the French title', () => {
    expect(routesTitle).toBe('Itinéraires');
  });
});
