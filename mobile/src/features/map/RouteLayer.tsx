import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n/t';
import type { RoutePoint } from '@/core/routing/routeRequest';
import { linkSegments } from '@/core/routing/routeLink';
import { colors, mapColors } from '@/ui/theme';

import type { RouteCreation } from './useRouteCreation';

// Widths of the mockup (zoom 15): line 7, casing 11. About x 0.6 at zoom 12
// and x 1.3 at zoom 17 (design/tokens.md).
function widthByZoom(at15: number) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    12,
    at15 * 0.6,
    15,
    at15,
    17,
    at15 * 1.3,
  ] as never;
}

function lngLat(p: RoutePoint): [number, number] {
  return [p.lon, p.lat];
}

// Start, end, refused point and the magenta line, inside the map.
export function RouteLayer({ state }: { state: RouteCreation }) {
  const { start, end, route, problem } = state;
  // Dotted link marker -> route, only with a route shown (tokens: trace.liaison).
  const links =
    route && start && end && !problem
      ? linkSegments(start, end, route.shape)
      : [];
  return (
    <>
      {/* Always mounted (empty when there is no link), and placed under the
          casing by beforeId: MapLibre puts a new layer on top otherwise. */}
      <GeoJSONSource
        id="route-link"
        data={{
          type: 'FeatureCollection',
          features: links.map((coordinates) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          })),
        }}
      >
        <Layer
          id="route-link-line"
          type="line"
          beforeId="route-casing"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': mapColors.routeLink,
            'line-width': widthByZoom(3),
            'line-dasharray': [0.1, 2.5],
          }}
        />
      </GeoJSONSource>
      {/* Also always mounted (empty without a route): route-casing must exist
          from the opening, or iOS forgets the link layer waiting for it. */}
      <GeoJSONSource
        id="route"
        data={
          route
            ? {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: route.shape },
              }
            : { type: 'FeatureCollection', features: [] }
        }
      >
        <Layer
          id="route-casing"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': mapColors.routeCasing,
            'line-width': widthByZoom(11),
          }}
        />
        <Layer
          id="route-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': mapColors.route,
            'line-width': widthByZoom(7),
          }}
        />
      </GeoJSONSource>
      {start && (
        <Marker id="route-start" lngLat={lngLat(start)}>
          <View
            testID="route-start"
            accessibilityLabel={t('route.startMarker')}
            style={[styles.round, { backgroundColor: mapColors.start }]}
          >
            <Svg width={12} height={12} viewBox="0 0 12 12">
              <Path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="#fff" />
            </Svg>
          </View>
        </Marker>
      )}
      {end && (!problem || !problem.isEnd) && (
        <Marker id="route-end" lngLat={lngLat(end)}>
          <View
            testID="route-end"
            accessibilityLabel={t('route.endMarker')}
            style={[styles.round, { backgroundColor: mapColors.end }]}
          >
            <Svg width={16} height={16} viewBox="0 0 16 16">
              <Path d="M3 15V1.5" stroke="#fff" strokeWidth={1.8} />
              <Path d="M3.9 2h10v7h-10z" fill="#fff" />
              <Path
                d="M3.9 2h3.3v3.5H3.9zM10.6 2h3.3v3.5h-3.3zM7.2 5.5h3.4V9H7.2z"
                fill="#111"
              />
            </Svg>
          </View>
        </Marker>
      )}
      {problem && (
        <Marker id="route-rejected" lngLat={lngLat(problem.point)}>
          <View
            testID="route-rejected"
            accessibilityLabel={t('route.rejectedMarker')}
            style={styles.rejected}
          >
            <Text style={styles.rejectedMark}>!</Text>
          </View>
        </Marker>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  round: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Round with dashes and "!" (mockup 52).
  rejected: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.brown,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectedMark: { fontSize: 17, fontWeight: '800', color: colors.brown },
});
