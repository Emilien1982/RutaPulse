import { StyleSheet, View } from 'react-native';

import { colors } from './theme';

export const BANNER_HEIGHT = 200;
const SUN_AREA_HEIGHT = 164;
const BANDS = [colors.mustard, colors.orange, colors.rust, colors.brown];

// Top banner of the tab screens: a striped sun over four bands of 9 points.
// It is decoration only; the screen puts its title over it or below it.
export function StripedBanner() {
  return (
    <View style={styles.banner} testID="striped-banner" accessible={false}>
      <View style={styles.sunArea}>
        <View style={styles.sun} />
        <View style={[styles.cut, { top: 143, height: 3 }]} />
        <View style={[styles.cut, { top: 152, height: 4 }]} />
      </View>
      {BANDS.map((color) => (
        <View key={color} style={[styles.band, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    alignSelf: 'stretch',
    backgroundColor: colors.cream,
  },
  sunArea: {
    height: SUN_AREA_HEIGHT,
    width: 90,
    alignSelf: 'flex-end',
    overflow: 'hidden',
  },
  sun: {
    position: 'absolute',
    left: 8,
    top: SUN_AREA_HEIGHT - 36,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mustard,
  },
  cut: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.cream,
  },
  band: { height: 9 },
});
