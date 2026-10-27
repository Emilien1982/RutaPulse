import type { ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DownloadIcon, MapIcon, RoutesIcon, SettingsIcon } from '@/ui/icons';
import { Stripes, STRIPES_HEIGHT } from '@/ui/Stripes';
import { colors, tabBar } from '@/ui/theme';

type TabIcon = (props: { color: string }) => React.JSX.Element;

// Tab bar of the mockups: brown bar under the 9-point stripes, 64 x 32
// mustard pill behind the icon of the active tab.
function pill(Icon: TabIcon) {
  return function TabBarIcon({ focused }: { focused: boolean }) {
    return (
      <View style={[styles.pill, focused && styles.pillActive]}>
        <Icon color={focused ? colors.brown : colors.onBrown} />
      </View>
    );
  };
}

function TabBarBackground() {
  return (
    <View style={styles.background}>
      <Stripes />
      <View style={styles.fill} />
    </View>
  );
}

export const tabIcons = {
  map: pill((p) => <MapIcon {...p} />),
  routes: pill((p) => <RoutesIcon {...p} />),
  zones: pill((p) => <DownloadIcon {...p} />),
  settings: pill((p) => <SettingsIcon {...p} />),
};

const ICON_LABEL_GAP = 3;
const LABEL_HEIGHT = 16;
const TOP_GAP = 7;
// Padding that the default tab button adds on every side (BottomTabItem).
const ITEM_PADDING = 5;

// Bar padding: the stripes and the gap above the pill, minus the padding of
// the button, so that the pill starts 16 points under the top of the stripes.
export const TAB_BAR_PADDING_TOP = STRIPES_HEIGHT + TOP_GAP - ITEM_PADDING;

// The bar adds the system bottom inset as padding inside its height. On iOS
// the bar overlaps the gesture zone by the stripes (9) and the button padding
// (5): 92 with an inset of 34. On Android the whole inset is kept
// (3-button navigation).
export function tabBarPaddingBottom(insetBottom: number, os = Platform.OS) {
  return os === 'ios'
    ? Math.max(insetBottom - STRIPES_HEIGHT - ITEM_PADDING, 0)
    : insetBottom;
}

export function tabBarHeight(insetBottom: number, os = Platform.OS) {
  return (
    TAB_BAR_PADDING_TOP +
    ITEM_PADDING +
    tabBar.pillHeight +
    ICON_LABEL_GAP +
    LABEL_HEIGHT +
    ITEM_PADDING +
    tabBarPaddingBottom(insetBottom, os)
  );
}

export function useTabScreenOptions(): ComponentProps<
  typeof Tabs
>['screenOptions'] {
  const { bottom } = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarBackground: TabBarBackground,
    tabBarActiveTintColor: colors.onBrown,
    tabBarInactiveTintColor: colors.onBrown,
    tabBarLabelStyle: {
      fontSize: 13,
      lineHeight: LABEL_HEIGHT,
      fontWeight: '500',
    },
    tabBarIconStyle: {
      width: tabBar.pillWidth,
      height: tabBar.pillHeight,
      marginBottom: ICON_LABEL_GAP,
    },
    tabBarStyle: {
      height: tabBarHeight(bottom),
      paddingTop: TAB_BAR_PADDING_TOP,
      paddingBottom: tabBarPaddingBottom(bottom),
      backgroundColor: colors.brown,
      borderTopWidth: 0,
    },
  };
}

const styles = StyleSheet.create({
  pill: {
    width: tabBar.pillWidth,
    height: tabBar.pillHeight,
    borderRadius: tabBar.pillHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.mustard },
  background: { flex: 1 },
  fill: { flex: 1, backgroundColor: colors.brown },
});
