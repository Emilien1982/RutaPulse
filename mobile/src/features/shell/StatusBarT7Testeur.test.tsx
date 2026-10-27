import { render } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';

// B1: the root layout puts a dark status bar (dark icons on cream).
const mockStatusBar = jest.fn();
jest.mock('expo-status-bar', () => ({
  StatusBar: (p: unknown) => {
    mockStatusBar(p);
    return null;
  },
}));
jest.mock('expo-router', () => {
  function Stack({ children }: { children?: unknown }) {
    return children ?? null;
  }
  Stack.Screen = function Screen() {
    return null;
  };
  return { Stack };
});
jest.mock('@/features/shell/FontGate', () => ({
  FontGate: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/features/shell/QueryProvider', () => ({
  QueryProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/features/zones/ZoneDownloaderStarter', () => ({
  ZoneDownloaderStarter: () => null,
}));

it('B1: the root layout renders a StatusBar with style "dark"', async () => {
  await render(<RootLayout />);
  expect(mockStatusBar).toHaveBeenCalled();
  expect(mockStatusBar.mock.calls[0][0]).toMatchObject({ style: 'dark' });
});
