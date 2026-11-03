import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import {
  formatMegabytes,
  formatOsmDate,
  formatProgress,
  type ZoneRow,
} from '@/core/zones/zoneRow';
import { Button } from '@/ui/Button';
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  MoreIcon,
  PauseIcon,
} from '@/ui/icons';
import { border, colors, radius, spacing, target, text } from '@/ui/theme';

import { ProgressBar } from './ProgressBar';
import { ZoneUpdate } from './ZoneUpdate';

export type ZoneCardProps = {
  row: ZoneRow;
  onDownload: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onMenu: (id: string) => void;
};

// One zone of the list (mockup 41): name, size and date, then what the
// state needs (button, progress, "Prête sans réseau").
export function ZoneCard({
  row,
  onDownload,
  onCancel,
  onRetry,
  onMenu,
}: ZoneCardProps) {
  const { id, name, status } = row;
  const size = formatMegabytes(row.totalBytes);
  const canCancel = status.kind !== 'available' && status.kind !== 'ready';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.text, canCancel && styles.textUnderCross]}>
          <Text numberOfLines={1} style={text.control}>
            {name}
          </Text>
          <Text style={text.secondary}>
            {t('zones.meta', { size, date: formatOsmDate(row.osmDate) })}
          </Text>

          {status.kind === 'ready' && (
            <View style={styles.line}>
              <CheckIcon color={colors.success} />
              <Text style={styles.ready}>{t('zones.ready')}</Text>
            </View>
          )}
          {status.kind === 'queued' && (
            <View style={styles.line}>
              <PauseIcon color={colors.brown} />
              <Text style={styles.progress}>{t('zones.queued')}</Text>
            </View>
          )}
          {status.kind === 'downloading' && (
            <>
              <ProgressBar
                label={t('zones.progressLabel', { name })}
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
                label={t('zones.progressLabel', { name })}
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
                      progress: formatProgress(
                        status.doneBytes,
                        status.totalBytes,
                      ),
                    },
                  )}
                </Text>
              </View>
            </>
          )}
          {status.kind === 'failed' && (
            <>
              <ProgressBar
                label={t('zones.progressLabel', { name })}
                done={status.doneBytes}
                total={status.totalBytes}
              />
              <Text style={[styles.progress, styles.error]}>
                {t('zones.failed', {
                  progress: formatProgress(status.doneBytes, status.totalBytes),
                })}
              </Text>
            </>
          )}
          {status.kind === 'no-space' && (
            <Text style={[styles.progress, styles.error]}>
              {t('zones.noSpace', {
                needed: formatMegabytes(status.neededBytes),
              })}
            </Text>
          )}
          {(status.kind === 'failed' || status.kind === 'no-space') && (
            <View style={styles.retry}>
              <Button
                variant="secondary"
                label={t('zones.retry')}
                accessibilityLabel={t('zones.retryLabel', { name })}
                onPress={() => onRetry(id)}
              />
            </View>
          )}
        </View>

        {status.kind === 'available' && (
          <Button
            variant="download"
            label={t('zones.download')}
            accessibilityLabel={t('zones.downloadLabel', { name, size })}
            icon={(color) => <DownloadIcon color={color} size={20} />}
            onPress={() => onDownload(id)}
          />
        )}
        {status.kind === 'ready' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('zones.menuLabel', { name })}
            onPress={() => onMenu(id)}
            style={styles.corner}
          >
            <MoreIcon color={colors.brown} />
          </Pressable>
        )}
        {canCancel && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('zones.cancelLabel', { name })}
            onPress={() => onCancel(id)}
            style={[styles.corner, styles.cornerAbsolute]}
          >
            <CloseIcon color={colors.brown} />
          </Pressable>
        )}
      </View>
      {row.update && (
        <ZoneUpdate
          row={row}
          update={row.update}
          onDownload={onDownload}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.card,
    paddingVertical: 10,
    paddingLeft: spacing.s4,
    paddingRight: 10,
    marginBottom: spacing.s2,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s2 },
  text: { flex: 1, minWidth: 0 },
  textUnderCross: { paddingRight: 40 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  ready: { ...text.secondary, color: colors.success, fontWeight: '700' },
  progress: {
    ...text.secondary,
    color: colors.brown,
    fontWeight: '600',
    marginTop: 5,
  },
  error: { color: colors.danger },
  retry: { marginTop: spacing.s2 },
  corner: {
    width: target.stop,
    height: target.stop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The card has 10 of padding at the top and on the right: -6 puts the cross
  // 4 from the corner of the card.
  cornerAbsolute: { position: 'absolute', top: -6, right: -6 },
});
