import {
  GeoJSONSource,
  Layer,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Draft } from '@/core/draft/draft';
import { t } from '@/core/i18n/t';
import type { Zone } from '@/core/zones/catalogue';
import { colors, mapColors, text } from '@/ui/theme';

import { DraftLayers } from './DraftLayers';
import type { LineCollection } from './draftGeometry';
import { endPoints, routeBounds } from './infoGeometry';
import { ZoneBaseMap } from './ZoneBaseMap';

// Window of the map of mockup 20 (hn.arche): 328 x 146, a border of 3, and
// three rings (5 mustard, 4 orange, 3 rust). React Native has no elliptical
// radius: the top is a circle of 96.
const WIDTH = 328;
const HEIGHT = 146;
const TOP = 96;
const BOTTOM = 18;
// Rings from the inside out: each one is thicker around the one before.
const RINGS = [
  { width: 5, color: colors.mustard, top: TOP + 5, bottom: BOTTOM + 5 },
  { width: 4, color: colors.orange, top: TOP + 9, bottom: BOTTOM + 9 },
  { width: 3, color: colors.rust, top: TOP + 12, bottom: BOTTOM + 12 },
];

// Sides clear the round corners; the bottom keeps the room of the attribution.
const FIT_PADDING = { top: 20, right: 56, bottom: 32, left: 56 };

// The route, in full, in the arch window: no gesture, start and arrival,
// the short attribution and the "i" button (convention of MapLibre).
export function RouteInfoMap({
  zone,
  draft,
  lines,
  links,
}: {
  zone: Zone;
  draft: Draft;
  lines: LineCollection;
  links: LineCollection;
}) {
  const mapRef = useRef<MapRef>(null);
  const bounds = useMemo(() => routeBounds(draft, lines), [draft, lines]);
  const ends = useMemo(() => endPoints(draft), [draft]);
  const fit = useMemo(
    () => (bounds ? { bounds, padding: FIT_PADDING } : undefined),
    [bounds],
  );

  let content = (
    <View
      testID="info-map"
      accessibilityLabel={t('info.mapLabel')}
      style={styles.window}
    >
      <ZoneBaseMap
        zone={zone}
        cameraRef={null}
        mapRef={mapRef}
        fit={fit}
        labels={false}
      >
        <DraftLayers lines={lines} links={links} />
        <GeoJSONSource id="info-ends" data={ends}>
          <Layer
            id="info-ends-circle"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': [
                'match',
                ['get', 'role'],
                'start',
                mapColors.start,
                mapColors.end,
              ] as never,
              'circle-stroke-width': 2,
              'circle-stroke-color': mapColors.routeCasing,
            }}
          />
        </GeoJSONSource>
      </ZoneBaseMap>
      <View style={styles.attribution}>
        <Text style={text.attribution}>{t('info.attributionShort')}</Text>
        <Pressable
          testID="info-attribution-button"
          accessibilityRole="button"
          accessibilityLabel={t('info.attributionButton')}
          hitSlop={16}
          onPress={() => void mapRef.current?.showAttribution()}
          style={styles.attributionButton}
        >
          <Text style={styles.attributionI}>i</Text>
        </Pressable>
      </View>
    </View>
  );
  for (const ring of RINGS) {
    content = (
      <View
        style={{
          borderWidth: ring.width,
          borderColor: ring.color,
          borderTopLeftRadius: ring.top,
          borderTopRightRadius: ring.top,
          borderBottomLeftRadius: ring.bottom,
          borderBottomRightRadius: ring.bottom,
        }}
      >
        {content}
      </View>
    );
  }
  return <View style={styles.center}>{content}</View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  window: {
    width: WIDTH,
    height: HEIGHT,
    borderWidth: 3,
    borderColor: colors.brown,
    borderTopLeftRadius: TOP,
    borderTopRightRadius: TOP,
    borderBottomLeftRadius: BOTTOM,
    borderBottomRightRadius: BOTTOM,
    overflow: 'hidden',
    backgroundColor: mapColors.background,
  },
  attribution: {
    position: 'absolute',
    right: 12,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: mapColors.attributionBackground,
    paddingLeft: 5,
    paddingRight: 2,
    paddingVertical: 1,
    borderRadius: 9,
  },
  attributionButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.brown2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attributionI: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    color: colors.brown2,
  },
});
