import { renderHook } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { useTabScreenOptions } from './tabScreenOptions';

let mockBottom = 0;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: mockBottom }),
}));

async function barStyle(os: 'ios' | 'android', bottom: number) {
  Platform.OS = os;
  mockBottom = bottom;
  const { result } = await renderHook(() => useTabScreenOptions());
  const options = result.current as {
    tabBarStyle: object;
    tabBarIconStyle: object;
  };
  return {
    bar: StyleSheet.flatten(options.tabBarStyle) as {
      height: number;
      paddingTop: number;
      paddingBottom: number;
    },
    icon: StyleSheet.flatten(options.tabBarIconStyle) as {
      height: number;
      marginBottom: number;
    },
  };
}

describe('tab bar layout', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  // The default tab button adds 5 on every side: with a top padding of 11
  // the pill starts 16 under the top of the stripes, the label ends at 67,
  // and the button's bottom padding brings the content to 72.
  it.each([
    ['ios', 34, 92, 20],
    ['ios', 0, 72, 0],
    ['android', 0, 72, 0],
    ['android', 48, 120, 48],
  ] as const)(
    '%s with inset %i: height %i, padding bottom %i',
    async (os, bottom, height, paddingBottom) => {
      const { bar, icon } = await barStyle(os, bottom);
      expect(bar.height).toBe(height);
      expect(bar.paddingTop).toBe(11);
      expect(bar.paddingBottom).toBe(paddingBottom);
      expect(icon.height).toBe(32);
      expect(icon.marginBottom).toBe(3);
    },
  );
});
