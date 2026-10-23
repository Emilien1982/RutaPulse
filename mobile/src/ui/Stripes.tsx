import { StyleSheet, View } from 'react-native';

import { colors } from './theme';

const BAND = 3;

// "hn.rayures": three bands of 3 points (mustard, orange, rust), 9 in all.
export function Stripes() {
  return (
    <View style={styles.stripes} testID="stripes" accessible={false}>
      <View style={[styles.band, { backgroundColor: colors.mustard }]} />
      <View style={[styles.band, { backgroundColor: colors.orange }]} />
      <View style={[styles.band, { backgroundColor: colors.rust }]} />
    </View>
  );
}

export const STRIPES_HEIGHT = BAND * 3;

const styles = StyleSheet.create({
  stripes: { height: STRIPES_HEIGHT, alignSelf: 'stretch' },
  band: { height: BAND },
});
