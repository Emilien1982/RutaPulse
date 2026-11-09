// One line of the list (mockup 40, states 1, 3 and 7a): medallion, name,
// figures, zone and origin. Touching the line opens it; a long press or the
// "⋮" button opens the menu.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import { decodePolyline6 } from '@/core/routing/routeResponse';
import type { RouteLine } from '@/core/routes/routeList';
import type { RouteSummary } from '@/core/routes/savedRoute';
import { MoreIcon } from '@/ui/icons';
import { RoutePreview } from '@/ui/RoutePreview';
import { border, colors, radius, spacing, target, text } from '@/ui/theme';

const MEDALLION = 64;
const RING = 3;
const INNER = MEDALLION - 2 * (RING + 3);

export function RouteItem({
  route,
  line,
  onOpen,
  onMenu,
}: {
  route: RouteSummary;
  line: RouteLine;
  onOpen: () => void;
  onMenu: () => void;
}) {
  // The preview is a short polyline (66 points at most): the only decoding.
  const track = useMemo(() => decodePolyline6(route.preview), [route.preview]);
  return (
    <View style={styles.card}>
      <Pressable
        testID={`route-row-${route.id}`}
        accessibilityRole="button"
        accessibilityLabel={line.label}
        onPress={onOpen}
        onLongPress={onMenu}
        style={styles.main}
      >
        <View style={styles.medallion} accessible={false}>
          <View style={styles.medallionInner}>
            <RoutePreview
              track={track}
              width={INNER}
              height={INNER}
              padding={9}
              lineWidth={3}
              dotRadius={4}
              background={colors.sand}
            />
          </View>
        </View>
        <View style={styles.texts}>
          <Text numberOfLines={1} style={styles.name}>
            {route.name}
          </Text>
          <Text style={styles.figures}>
            <Text style={styles.bold}>{line.distance}</Text>
            {line.rest}
          </Text>
          {line.problem ? (
            <View style={styles.problemRow}>
              <View style={styles.signal}>
                <Text style={styles.signalMark}>!</Text>
              </View>
              <Text numberOfLines={1} style={[styles.meta, styles.problem]}>
                {line.meta}
              </Text>
            </View>
          ) : (
            <Text numberOfLines={1} style={styles.meta}>
              {line.meta}
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        testID={`route-menu-${route.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('routes.menuLabel', { name: route.name })}
        onPress={onMenu}
        style={styles.more}
      >
        <MoreIcon color={colors.brown} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 2,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.button48,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingVertical: spacing.s2,
  },
  medallion: {
    width: MEDALLION,
    height: MEDALLION,
    padding: 3,
    borderWidth: RING,
    borderColor: colors.brown,
    borderRadius: MEDALLION / 2,
    backgroundColor: colors.mustard,
  },
  medallionInner: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: INNER / 2,
  },
  texts: { flex: 1 },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.brown,
  },
  figures: { ...text.secondary, color: colors.brown, marginTop: 3 },
  bold: { fontWeight: '800' },
  meta: { ...text.caption, marginTop: 3 },
  problemRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  problem: { flex: 1, color: colors.brown, fontWeight: '700' },
  signal: {
    width: 16,
    height: 16,
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brown,
    borderRadius: 8,
  },
  signalMark: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    color: colors.brown,
  },
  more: {
    width: target.stop,
    height: target.stop,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
