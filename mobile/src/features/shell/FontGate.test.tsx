import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FontGate } from './FontGate';

const mockUseFonts = jest.fn();
jest.mock('expo-font', () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

describe('FontGate', () => {
  it('shows nothing while the font loads', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    await render(
      <FontGate>
        <Text>App</Text>
      </FontGate>,
    );
    expect(screen.queryByText('App')).toBeNull();
  });

  it('shows the app once the font is loaded', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    await render(
      <FontGate>
        <Text>App</Text>
      </FontGate>,
    );
    expect(screen.getByText('App')).toBeTruthy();
  });

  it('shows the app anyway if the font fails to load', async () => {
    mockUseFonts.mockReturnValue([false, new Error('boom')]);
    await render(
      <FontGate>
        <Text>App</Text>
      </FontGate>,
    );
    expect(screen.getByText('App')).toBeTruthy();
  });
});
