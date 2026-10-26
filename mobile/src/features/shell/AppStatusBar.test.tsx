import { render } from '@testing-library/react-native';

import { AppStatusBar } from './AppStatusBar';

const mockStatusBar = jest.fn();
jest.mock('expo-status-bar', () => ({
  StatusBar: (props: unknown) => {
    mockStatusBar(props);
    return null;
  },
}));

describe('B1: status bar', () => {
  it('has dark icons, and the app is forced to the light theme', async () => {
    await render(<AppStatusBar />);
    expect(mockStatusBar).toHaveBeenCalledWith({ style: 'dark' });
    const appJson = require('../../../app.json') as {
      expo: { userInterfaceStyle: string };
    };
    expect(appJson.expo.userInterfaceStyle).toBe('light');
  });
});
