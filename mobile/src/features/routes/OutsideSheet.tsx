// The sheet "GPX hors de vos zones" (mockup 40, state 6c and its variants).
// It offers the zone of the catalogue that holds the track, if it finds one.

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import { formatMegabytes } from '@/core/zones/zoneRow';
import type { Zone } from '@/core/zones/catalogue';
import { Button } from '@/ui/Button';
import { border, colors, radius, spacing, target, text } from '@/ui/theme';

/** `found`: a zone to download. `none`: no zone. `offline`: not searched. */
export type Offer =
  { kind: 'found'; zone: Zone } | { kind: 'none' } | { kind: 'offline' };

type Props = {
  offer: Offer;
  onDownload: (zone: Zone) => void;
  onSeeZones: () => void;
  onClose: () => void;
};

export function OutsideSheet({
  offer,
  onDownload,
  onSeeZones,
  onClose,
}: Props) {
  const later = (
    <Pressable
      testID="outside-later"
      accessibilityRole="button"
      onPress={onClose}
      style={styles.later}
    >
      <Text style={[text.control, styles.laterText]}>
        {t('routes.outsideLater')}
      </Text>
    </Pressable>
  );
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          testID="outside-backdrop"
          accessible={false}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={text.titleName}>
            {t('routes.outsideTitle')}
          </Text>
          <Text testID="outside-text" style={[text.body, styles.gap]}>
            {t('routes.outsideText')}{' '}
            {offer.kind === 'found'
              ? t('routes.outsideFound', { zone: offer.zone.name })
              : t(
                  offer.kind === 'none'
                    ? 'routes.outsideNone'
                    : 'routes.outsideOffline',
                )}
          </Text>
          <View style={styles.gap}>
            {offer.kind === 'found' && (
              <>
                <Button
                  testID="outside-download"
                  variant="download"
                  label={t('routes.outsideDownload', {
                    zone: offer.zone.name,
                    size: formatMegabytes(offer.zone.totalBytes),
                  })}
                  onPress={() => onDownload(offer.zone)}
                />
                {later}
              </>
            )}
            {offer.kind === 'none' && (
              <Button
                testID="outside-close"
                variant="secondary"
                label={t('routes.outsideClose')}
                onPress={onClose}
              />
            )}
            {offer.kind === 'offline' && (
              <>
                <Button
                  testID="outside-zones"
                  variant="secondary"
                  label={t('routes.seeZones')}
                  onPress={onSeeZones}
                />
                {later}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#3A1F0F66' },
  sheet: {
    backgroundColor: colors.cream,
    borderWidth: border.strong,
    borderBottomWidth: 0,
    borderColor: colors.brown,
    borderTopLeftRadius: radius.button56,
    borderTopRightRadius: radius.button56,
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s6,
  },
  gap: { marginTop: spacing.s3 },
  later: {
    minHeight: target.stop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: { color: colors.brown, textDecorationLine: 'underline' },
});
