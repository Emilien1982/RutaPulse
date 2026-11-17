import * as SplashScreen from 'expo-splash-screen';

import { setSplashScreenOptions } from './splashScreenOptions';

jest.mock('expo-splash-screen', () => ({ setOptions: jest.fn() }));

describe('setSplashScreenOptions', () => {
  it('asks for a fade of 300 ms', () => {
    setSplashScreenOptions();
    expect(SplashScreen.setOptions).toHaveBeenCalledWith({
      fade: true,
      duration: 300,
    });
  });
});
