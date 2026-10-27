import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';
import {
  formatFreeSpace,
  formatMegabytes,
  type ZoneRows,
} from '@/core/zones/zoneRow';
import { Button } from '@/ui/Button';
import { WifiOffIcon } from '@/ui/icons';
import { ScreenFrame } from '@/ui/ScreenFrame';
import { SwitchRow } from '@/ui/SwitchRow';
import { border, colors, spacing, text } from '@/ui/theme';

import { ZoneCard, type ZoneCardProps } from './ZoneCard';

export type CatalogueStatus = 'loading' | 'ready' | 'error';

export type ZonesViewProps = Omit<ZoneCardProps, 'row'> & {
  rows: ZoneRows;
  catalogue: CatalogueStatus;
  onReloadCatalogue: () => void;
  freeBytes: number | null;
  wifiOnly: boolean;
  onWifiOnlyChange: (value: boolean) => void;
};

function Section({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.section}>
      <Text style={text.sectionLabel}>{title}</Text>
      {detail !== undefined && <Text style={text.caption}>{detail}</Text>}
    </View>
  );
}

// Screen "Zones hors ligne" (mockup 41), without any data access: everything
// comes through the props.
export function ZonesView({
  rows,
  catalogue,
  onReloadCatalogue,
  freeBytes,
  wifiOnly,
  onWifiOnlyChange,
  ...cardActions
}: ZonesViewProps) {
  return (
    <ScreenFrame title={t('zones.title')}>
      {rows.waitingForWifi && (
        <View accessibilityRole="alert" style={styles.alert}>
          <View style={styles.alertTop}>
            <WifiOffIcon color={colors.brown} />
            <Text style={[text.secondary, styles.alertText]}>
              <Text style={styles.bold}>{t('zones.noWifiBanner')}</Text>{' '}
              {t('zones.noWifiBannerText')}
            </Text>
          </View>
          <View style={styles.alertSwitch}>
            <SwitchRow
              label={t('settings.wifiOnly')}
              value={wifiOnly}
              onValueChange={onWifiOnlyChange}
            />
          </View>
        </View>
      )}

      {rows.installed.length > 0 && (
        <>
          <Section
            title={t('zones.sectionInstalled')}
            detail={formatMegabytes(rows.installedBytes)}
          />
          {rows.installed.map((row) => (
            <ZoneCard key={row.id} row={row} {...cardActions} />
          ))}
        </>
      )}

      <Section
        title={t('zones.sectionAvailable')}
        detail={freeBytes === null ? undefined : formatFreeSpace(freeBytes)}
      />
      {rows.available.map((row) => (
        <ZoneCard key={row.id} row={row} {...cardActions} />
      ))}
      {catalogue === 'loading' && rows.available.length === 0 && (
        <Text style={[text.secondary, styles.message]}>
          {t('zones.catalogueLoading')}
        </Text>
      )}
      {catalogue === 'error' && (
        <View style={styles.error}>
          <Text style={text.titleName}>{t('zones.catalogueError')}</Text>
          <Text style={[text.secondary, styles.message]}>
            {t('zones.catalogueErrorHelp')}
          </Text>
          <Button
            variant="secondary"
            label={t('zones.retry')}
            onPress={onReloadCatalogue}
          />
        </View>
      )}
      <Text style={[text.secondary, styles.explanation]}>
        {t('zones.explanation')}
      </Text>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  alert: {
    backgroundColor: colors.mustardPale,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: 20,
    paddingTop: spacing.s2,
    paddingHorizontal: spacing.s3,
    marginBottom: spacing.s1,
  },
  alertTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  alertText: { flex: 1, color: colors.brown },
  bold: { fontWeight: '700' },
  alertSwitch: {
    marginTop: spacing.s1,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(58,31,15,0.55)',
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.s3,
    marginBottom: 6,
    marginHorizontal: spacing.s1,
  },
  explanation: { marginTop: spacing.s3, marginHorizontal: spacing.s1 },
  message: { marginVertical: spacing.s2 },
  error: { gap: spacing.s2, paddingVertical: spacing.s2 },
});
