import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Tabs } from 'expo-router';

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

export const tabScreenOptions: ComponentProps<typeof Tabs>['screenOptions'] = {
  headerShown: false,
  tabBarBackground: TabBarBackground,
  tabBarActiveTintColor: colors.onBrown,
  tabBarInactiveTintColor: colors.onBrown,
  tabBarLabelStyle: { fontSize: 13, fontWeight: '500' },
  tabBarStyle: {
    height: tabBar.height + STRIPES_HEIGHT,
    paddingTop: STRIPES_HEIGHT + 7,
    backgroundColor: colors.brown,
    borderTopWidth: 0,
  },
};

const styles = StyleSheet.create({
  pill: {
    marginBottom: 3,
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
