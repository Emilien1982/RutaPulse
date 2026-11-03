import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import {
  formatMegabytes,
  formatOsmDate,
  formatProgress,
  type RowUpdate,
  type ZoneRow,
} from '@/core/zones/zoneRow';
import { Button } from '@/ui/Button';
import { DashedRule } from '@/ui/DashedRule';
import { CloseIcon, DownloadIcon, PauseIcon } from '@/ui/icons';
import { colors, spacing, target, text } from '@/ui/theme';

import { ProgressBar } from './ProgressBar';

type ZoneUpdateProps = {
  row: ZoneRow;
  update: RowUpdate;
  onDownload: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
};

// The "update" part of the card of a ready zone (mockup 41, screens 2 to 4):
// below a dashed line, it offers the newer version or shows its download.
// The old version stays in service, as the card above says.
export function ZoneUpdate({
  row,
  update,
  onDownload,
  onCancel,
  onRetry,
}: ZoneUpdateProps) {
  const { id, name } = row;
  const size = formatMegabytes(update.zone.totalBytes);
  // Same map date as the one in service: the date would tell nothing.
  const sameDate = update.zone.osmDate === row.osmDate;
  const date = formatOsmDate(update.zone.osmDate);

  if (update.kind === 'available') {
    return (
      <View style={styles.part}>
        <View style={styles.rule}>
          <DashedRule />
        </View>
        <Text style={styles.title}>{t('zones.updateAvailable')}</Text>
        <Text style={text.secondary}>
          {sameDate ? size : t('zones.meta', { size, date })}
        </Text>
        <View style={styles.action}>
          <Button
            variant="download"
            label={t('zones.update')}
            accessibilityLabel={t('zones.updateLabel', { name, size })}
            icon={(color) => <DownloadIcon color={color} size={20} />}
            onPress={() => onDownload(id)}
          />
        </View>
      </View>
    );
  }

  const status = update.status;
  const progressLabel = t('zones.updateProgressLabel', { name });
  const usable =
    status.kind === 'failed' || status.kind === 'no-space'
      ? t('zones.updateUsableOld', {
          // "18 oct." already ends with a dot: the sentence adds its own.
          date: formatOsmDate(row.osmDate).replace(/\.$/, ''),
        })
      : t('zones.updateUsable');

  return (
    <View style={styles.part}>
      <View style={styles.rule}>
        <DashedRule />
      </View>
      <Text style={[styles.title, styles.underCross]}>
        {sameDate
          ? t('zones.updateTitleNoDate')
          : t('zones.updateTitle', { date })}
      </Text>
      {status.kind === 'queued' && (
        <View style={styles.line}>
          <PauseIcon color={colors.brown} />
          <Text style={styles.progress}>{t('zones.queued')}</Text>
        </View>
      )}
      {status.kind === 'downloading' && (
        <>
          <ProgressBar
            label={progressLabel}
            done={status.doneBytes}
            total={status.totalBytes}
          />
          <Text style={styles.progress}>
            {formatProgress(status.doneBytes, status.totalBytes)}
          </Text>
        </>
      )}
      {status.kind === 'waiting' && (
        <>
          <ProgressBar
            label={progressLabel}
            done={status.doneBytes}
            total={status.totalBytes}
          />
          <View style={styles.line}>
            <PauseIcon color={colors.brown} />
            <Text style={styles.progress}>
              {t(
                status.reason === 'no-wifi'
                  ? 'zones.waitingWifi'
                  : 'zones.waitingNetwork',
                {
                  progress: formatProgress(status.doneBytes, status.totalBytes),
                },
              )}
            </Text>
          </View>
        </>
      )}
      {status.kind === 'failed' && (
        <>
          <ProgressBar
            label={progressLabel}
            done={status.doneBytes}
            total={status.totalBytes}
          />
          <Text style={[styles.progress, styles.error]}>
            {t('zones.updateFailed', {
              progress: formatProgress(status.doneBytes, status.totalBytes),
            })}
          </Text>
        </>
      )}
      {status.kind === 'no-space' && (
        <Text style={[styles.progress, styles.error]}>
          {t('zones.noSpace', { needed: formatMegabytes(status.neededBytes) })}
        </Text>
      )}
      <Text style={styles.note}>{usable}</Text>
      {(status.kind === 'failed' || status.kind === 'no-space') && (
        <View style={styles.action}>
          <Button
            variant="secondary"
            label={t('zones.retry')}
            accessibilityLabel={t('zones.updateRetryLabel', { name })}
            onPress={() => onRetry(id)}
          />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('zones.updateCancelLabel', { name })}
        onPress={() => onCancel(id)}
        style={styles.cross}
      >
        <CloseIcon color={colors.brown} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  part: {
    marginTop: 10,
  },
  rule: { marginBottom: spacing.s2 },
  title: { ...text.secondary, color: colors.brown, fontWeight: '700' },
  underCross: { paddingRight: 44 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  progress: {
    ...text.secondary,
    color: colors.brown,
    fontWeight: '600',
    marginTop: 5,
  },
  error: { color: colors.danger },
  note: { ...text.secondary, marginTop: 3 },
  action: { marginTop: spacing.s2, alignSelf: 'flex-start' },
  cross: {
    position: 'absolute',
    top: -4, // -6 below the 2-pt rule (mockup 41)
    right: -6,
    width: target.stop,
    height: target.stop,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
