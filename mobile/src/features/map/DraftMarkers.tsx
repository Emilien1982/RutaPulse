import { Marker, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { DraftPoint } from '@/core/draft/draft';
import { t } from '@/core/i18n/t';
import { clampToBbox } from '@/core/zones/activeZone';
import type { Bbox } from '@/core/zones/catalogue';
import { colors, mapColors, markerShadow } from '@/ui/theme';

type Role = 'start' | 'end' | 'middle';

function roleOf(index: number, count: number): Role {
  if (index === 0) return 'start';
  return index === count - 1 ? 'end' : 'middle';
}

// Every marker sits in a square of 48 (the size of a finger target); the halo
// of the chosen point is drawn behind it.
function PointMarker({
  role,
  number,
  chosen,
}: {
  role: Role;
  number: number;
  chosen: boolean;
}) {
  const label =
    role === 'start'
      ? t(chosen ? 'route.startMarkerChosen' : 'route.startMarker')
      : role === 'end'
        ? t(chosen ? 'route.endMarkerChosen' : 'route.endMarker')
        : t(chosen ? 'route.pointLabelSelected' : 'route.pointLabel', {
            n: String(number),
          });
  return (
    <View
      testID={`draft-marker-${number}`}
      accessibilityLabel={label}
      style={styles.cell}
    >
      {chosen && <View testID="draft-marker-halo" style={styles.halo} />}
      {role === 'middle' ? (
        <View style={styles.number}>
          <Text style={styles.numberText}>{number}</Text>
        </View>
      ) : role === 'start' ? (
        <View style={[styles.round, { backgroundColor: mapColors.start }]}>
          <Svg width={12} height={12} viewBox="0 0 12 12">
            <Path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="#fff" />
          </Svg>
        </View>
      ) : (
        <View style={[styles.round, { backgroundColor: mapColors.end }]}>
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path d="M3 15V1.5" stroke="#fff" strokeWidth={1.8} />
            <Path d="M3.9 2h10v7h-10z" fill="#fff" />
            <Path
              d="M3.9 2h3.3v3.5H3.9zM10.6 2h3.3v3.5h-3.3zM7.2 5.5h3.4V9H7.2z"
              fill="#111"
            />
          </Svg>
        </View>
      )}
    </View>
  );
}

type Position = { lon: number; lat: number };

export type MarkerHandlers = {
  onChoose: (id: number) => void;
  onDragStart: (id: number) => void;
  onDrag: (id: number, position: Position) => void;
  onDragEnd: (id: number, position: Position) => void;
  /** The annotation is gone (removed, refused, or drawn again with a new key). */
  onGone: (id: number) => void;
};

// The React key holds the role, the number and the choice: after a removal
// the image of an annotation can stay frozen on iOS, and Android draws the
// halo of a chosen point only with a new key (ADR 0016, "Contrôles").
function annotationKey(
  point: DraftPoint,
  role: Role,
  number: number,
  chosen: boolean,
) {
  return `${point.id}-${role}-${number}-${chosen}`;
}

// One annotation. Memoized, with a stable `lngLat`: when nothing of this
// point changes, it is not drawn again during the gesture of another one.
const PointAnnotation = memo(function PointAnnotation({
  point,
  role,
  number,
  chosen,
  handlers,
}: {
  point: DraftPoint;
  role: Role;
  number: number;
  chosen: boolean;
  handlers: MarkerHandlers;
}) {
  const { id, lon, lat } = point;
  const lngLat = useMemo<[number, number]>(() => [lon, lat], [lon, lat]);
  useEffect(() => () => handlers.onGone(id), [handlers, id]);
  return (
    <ViewAnnotation
      id={`draft-point-${id}`}
      draggable
      lngLat={lngLat}
      onPress={() => handlers.onChoose(id)}
      onDragStart={() => handlers.onDragStart(id)}
      onDrag={(e) => {
        const [x, y] = e.nativeEvent.lngLat;
        handlers.onDrag(id, { lon: x, lat: y });
      }}
      onDragEnd={(e) => {
        const [x, y] = e.nativeEvent.lngLat;
        handlers.onDragEnd(id, { lon: x, lat: y });
      }}
    >
      <PointMarker role={role} number={number} chosen={chosen} />
    </ViewAnnotation>
  );
});

// The points of the draft, as draggable annotations of the map. `handlers`
// must be stable, or the memo is worth nothing.
export const DraftMarkers = memo(function DraftMarkers({
  points,
  chosenId,
  refusedId,
  handlers,
}: {
  points: DraftPoint[];
  chosenId: number | null;
  /** The point shown as refused, drawn by `RefusedMarker` instead. */
  refusedId: number | null;
  handlers: MarkerHandlers;
}) {
  return (
    <>
      {points.map((point, index) => {
        if (point.id === refusedId) return null;
        const role = roleOf(index, points.length);
        const number = index + 1;
        const chosen = point.id === chosenId;
        return (
          <PointAnnotation
            key={annotationKey(point, role, number, chosen)}
            point={point}
            role={role}
            number={number}
            chosen={chosen}
            handlers={handlers}
          />
        );
      })}
    </>
  );
});

// The refused point (mockup 52): white round, dashed brown border, "!", and
// a halo of 40. Beside it, "Hors de la zone" on the edge of the zone when the
// point is outside of it.
export function RefusedMarker({
  point,
  outsideBbox,
}: {
  point: Position;
  outsideBbox?: Bbox;
}) {
  return (
    <>
      {outsideBbox && <ZoneEdgeLabel point={point} bbox={outsideBbox} />}
      <Marker id="draft-refused" lngLat={[point.lon, point.lat]}>
        <View
          testID="route-rejected"
          accessibilityLabel={t('route.rejectedMarker')}
          style={styles.refusedCell}
        >
          <View style={styles.refusedHalo} />
          <View style={styles.refused}>
            <Text style={styles.refusedMark}>!</Text>
          </View>
        </View>
      </Marker>
    </>
  );
}

// Label on the edge of the zone, on the side of the outside (mockup 52).
function ZoneEdgeLabel({ point, bbox }: { point: Position; bbox: Bbox }) {
  const [lon, lat] = clampToBbox(bbox, point.lon, point.lat);
  const over = {
    right: point.lon - bbox.lonMax,
    left: bbox.lonMin - point.lon,
    top: point.lat - bbox.latMax,
    bottom: bbox.latMin - point.lat,
  };
  const side = (Object.keys(over) as (keyof typeof over)[]).reduce((a, b) =>
    over[b] > over[a] ? b : a,
  );
  // The label starts 10 away from the edge, on the outside, and 24 along the
  // edge from the point: under it in the mockup, never on top of it.
  const placement = {
    right: { anchor: 'top-left', offset: [10, 24] },
    left: { anchor: 'top-right', offset: [-10, 24] },
    top: { anchor: 'bottom-left', offset: [24, -10] },
    bottom: { anchor: 'top-left', offset: [24, 10] },
  } as const;
  const { anchor, offset } = placement[side];
  return (
    <Marker
      id="draft-edge-label"
      lngLat={[lon, lat]}
      anchor={anchor}
      offset={[...offset]}
    >
      <View testID="route-edge-label" style={styles.edgeLabel}>
        <Text style={styles.edgeLabelText}>{t('route.outsideLabel')}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Halo of the chosen point: magenta at 22 % (mockup 10, dragged point).
  halo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(194, 0, 122, 0.22)',
  },
  round: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...markerShadow,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: mapColors.route,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...markerShadow,
  },
  numberText: { fontSize: 15, fontWeight: '800', color: '#111' },
  refusedCell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ring of 6 around the round of 28: brown at 18 %.
  refusedHalo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(58, 31, 15, 0.18)',
  },
  refused: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.brown,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...markerShadow,
  },
  refusedMark: { fontSize: 17, fontWeight: '800', color: colors.brown },
  edgeLabel: {
    backgroundColor: 'rgba(251, 241, 218, 0.92)',
    borderWidth: 2,
    borderColor: colors.brown,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 6,
    maxWidth: 84,
  },
  edgeLabelText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.brown,
  },
});
