// The sheet of a waymarked circuit and the short list "{n} circuits passent
// ici" (mockup 12, screens 2 to 5 and variants A to G; ADR 0020, section 9).

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import { trailSummary, trailTitle } from '@/core/trails/trailSummary';
import type { Trail } from '@/core/trails/trails';
import { updateOffer, type UpdatePhase } from '@/core/trails/updateOffer';
import type { Zone } from '@/core/zones/catalogue';
import { formatMegabytes } from '@/core/zones/zoneRow';
import { useCatalogue } from '@/shared-data/zones/useCatalogue';
import { Button } from '@/ui/Button';
import { CloseIcon } from '@/ui/icons';
import {
  border,
  colors,
  radius,
  sheetShadow,
  spacing,
  target,
  text,
} from '@/ui/theme';

type SheetProps = {
  trail: Trail;
  /** The zone on the map: its name and its version. */
  zone: Zone;
  /** False when the position of the user is unknown. */
  hasPosition: boolean;
  /** State of the download of a newer version of the zone, if any. */
  phase?: UpdatePhase;
  onClose: () => void;
  onMake: () => void;
  onUpdateZone: (zone: Zone) => void;
  onSeeZones: () => void;
};

// The one Modal. A second Modal presented while the first one closes is
// refused by iOS: the list and the sheet share this one (`TrailPanel`).
function Frame({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          testID="trail-backdrop"
          accessible={false}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Head({ kicker, onClose }: { kicker: string; onClose: () => void }) {
  return (
    <View style={styles.topRow}>
      <Text style={[text.sectionLabel, styles.kicker]}>{kicker}</Text>
      <Pressable
        testID="trail-close"
        accessibilityRole="button"
        accessibilityLabel={t('trails.close')}
        onPress={onClose}
        style={styles.close}
      >
        <CloseIcon color={colors.brown} />
      </Pressable>
    </View>
  );
}

function OldZone({
  zone,
  phase,
  onUpdateZone,
  onSeeZones,
}: Pick<SheetProps, 'zone' | 'phase' | 'onUpdateZone' | 'onSeeZones'>) {
  const catalogue = useCatalogue();
  // Offline only when the reading failed or waits for a network (as the
  // Zones tab): during the first reading, the sheet does not claim it.
  const offer = updateOffer(
    zone,
    {
      zones: catalogue.data?.zones,
      offline: catalogue.isError || catalogue.fetchStatus === 'paused',
    },
    phase,
  );
  const seeZones = (
    <Button
      testID="trail-see-zones"
      variant="secondary"
      label={t('routes.seeZones')}
      onPress={onSeeZones}
    />
  );
  if (offer.kind === 'running') {
    return (
      <>
        <Text style={text.body}>
          <Text style={styles.bold}>{t('trails.updatingTitle')}</Text>{' '}
          {t('trails.updatingText')}
        </Text>
        <View style={styles.gap}>{seeZones}</View>
      </>
    );
  }
  if (offer.kind === 'failed') {
    return (
      <>
        <Text style={text.body}>
          <Text style={styles.bold}>{t('trails.updateFailedTitle')}</Text>{' '}
          {t('trails.updateFailedText')}
        </Text>
        <View style={styles.gap}>{seeZones}</View>
      </>
    );
  }
  if (offer.kind === 'loading') {
    return (
      <Text style={text.body}>
        <Text style={styles.bold}>{t('trails.oldZoneTitle')}</Text>{' '}
        {t('trails.oldZoneText', { zone: zone.name })}
      </Text>
    );
  }
  if (offer.kind === 'none') {
    return (
      <Text style={text.body}>
        <Text style={styles.bold}>{t('trails.notYetTitle')}</Text>{' '}
        {t('trails.notYetText')}
      </Text>
    );
  }
  if (offer.kind === 'offline') {
    return (
      <>
        <Text style={text.body}>
          <Text style={styles.bold}>{t('trails.oldZoneTitle')}</Text>{' '}
          {t('trails.oldZoneTextOffline', { zone: zone.name })}
        </Text>
        <View style={styles.gap}>{seeZones}</View>
      </>
    );
  }
  const size = formatMegabytes(offer.zone.totalBytes);
  return (
    <>
      <Text style={text.body}>
        <Text style={styles.bold}>{t('trails.oldZoneTitle')}</Text>{' '}
        {t('trails.oldZoneText', { zone: zone.name })}
      </Text>
      <View style={styles.gap}>
        <Button
          testID="trail-update"
          label={t('trails.oldZoneUpdate', { size })}
          accessibilityLabel={t('zones.updateLabel', {
            name: zone.name,
            size,
          })}
          onPress={() => onUpdateZone(offer.zone)}
        />
        <Text style={[text.secondary, styles.note]}>
          {t('zones.updateUsable')}
        </Text>
      </View>
    </>
  );
}

/** The four cases of the ADR 0020, section 9. */
function SheetContent(props: SheetProps) {
  const { trail, hasPosition, onClose, onMake } = props;
  const line = trail.line;
  const title = trailTitle(trail);

  let body: React.ReactNode;
  if (line.kind === 'ordered') {
    const start = line.loop
      ? t(hasPosition ? 'trails.startNearest' : 'trails.startUnknown')
      : t('trails.startOneWay');
    body = (
      <>
        <Text testID="trail-explain" style={text.body}>
          {t('trails.explain')} <Text style={styles.bold}>{start}</Text>{' '}
          {t('trails.editLater')}
          {line.removedM > 0 ? ` ${t('trails.variantsDropped')}` : ''}
        </Text>
        <View style={styles.gap}>
          <Button
            testID="trail-make"
            label={t('trails.make')}
            accessibilityLabel={t('trails.makeLabel', { name: title })}
            onPress={onMake}
          />
        </View>
      </>
    );
  } else if (line.kind === 'refused') {
    // The reason (parts, branches, too much removed) is not told apart: the
    // designer wrote one message for all (mockup 12, screen 4).
    body = (
      <Text style={text.body}>
        <Text style={styles.bold}>{t('trails.cannotTitle')}</Text>{' '}
        {t('trails.cannotText')} {t('trails.cannotHint')}
      </Text>
    );
  } else {
    body = <OldZone {...props} />;
  }

  return (
    <>
      <Head kicker={t('trails.kicker')} onClose={onClose} />
      <Text accessibilityRole="header" style={text.titleName}>
        {title}
      </Text>
      <Text testID="trail-summary" style={[text.secondary, styles.summary]}>
        {trailSummary(trail)}
      </Text>
      <View style={styles.gap}>{body}</View>
      <Text style={[text.attribution, styles.source]}>
        {t('trails.source')}
      </Text>
    </>
  );
}

/** The sheet of one circuit, in its own Modal. */
export function TrailSheet(props: SheetProps) {
  return (
    <Frame onClose={props.onClose}>
      <SheetContent {...props} />
    </Frame>
  );
}

/** Several circuits under the finger: the nearest first. */
function ListContent({
  trails,
  onChoose,
  onClose,
}: {
  trails: Trail[];
  onChoose: (trail: Trail) => void;
  onClose: () => void;
}) {
  return (
    <>
      <Head kicker={t('trails.kickerMany')} onClose={onClose} />
      <Text accessibilityRole="header" style={text.titleName}>
        {t('trails.manyTitle', { n: trails.length })}
      </Text>
      <View style={styles.gap}>
        {trails.map((trail) => (
          <Pressable
            key={trail.osmId}
            testID={`trail-row-${trail.osmId}`}
            accessibilityRole="button"
            accessibilityLabel={t('trails.manyLabel', {
              name: trailTitle(trail),
              summary: trailSummary(trail),
            })}
            onPress={() => onChoose(trail)}
            style={styles.row}
          >
            <Text style={text.control}>{trailTitle(trail)}</Text>
            <Text style={text.secondary}>{trailSummary(trail)}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

type ListProps = {
  trails: Trail[];
  onChoose: (trail: Trail) => void;
  onClose: () => void;
};

export function TrailListSheet(props: ListProps) {
  return (
    <Frame onClose={props.onClose}>
      <ListContent {...props} />
    </Frame>
  );
}

/**
 * The one Modal of the map tab: the list of circuits, then the sheet of the
 * chosen one in the same Modal. `many` shows the list, `one` the sheet.
 */
export function TrailPanel({
  many,
  one,
}: {
  many?: ListProps;
  one?: SheetProps;
}) {
  const onClose = (many ?? one)!.onClose;
  return (
    <Frame onClose={onClose}>
      {one ? <SheetContent {...one} /> : <ListContent {...many!} />}
    </Frame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#3A1F0F33' },
  sheet: {
    backgroundColor: colors.cream,
    borderWidth: border.strong,
    borderBottomWidth: 0,
    borderColor: colors.brown,
    borderTopLeftRadius: radius.button56,
    borderTopRightRadius: radius.button56,
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s2,
    paddingBottom: spacing.s6,
    ...sheetShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: { flex: 1 },
  close: {
    width: target.stop,
    height: target.stop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { marginTop: spacing.s1 },
  gap: { marginTop: spacing.s3 },
  bold: { fontWeight: '700' },
  note: { marginTop: spacing.s2, textAlign: 'center' },
  source: { marginTop: spacing.s3 },
  row: {
    minHeight: target.stop,
    paddingVertical: spacing.s2,
    borderBottomWidth: border.normal,
    borderBottomColor: colors.sand,
  },
});
