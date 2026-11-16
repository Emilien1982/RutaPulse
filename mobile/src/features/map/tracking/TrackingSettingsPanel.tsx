// The gear of the tracking and its panel of settings (mockups 30 and 31b,
// ADR 0021, section 8.6). The panel is a plain View at the bottom, not a
// Modal: no veil, the guidance above goes on living.

import { useMemo } from 'react';
import {
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n/t';
import type { BrightnessChoice } from '@/core/tracking/brightness';
import { SettingsIcon, SunIcon } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';
import { navColors } from '@/ui/theme';

// A drag of the panel downward longer than this closes it.
const SWIPE_CLOSE_PX = 40;

/** Under the compass, same axis; 64 to touch, 48 drawn. Black while open. */
export function SettingsGear({
  open,
  onPress,
}: {
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="tracking-gear"
      accessibilityRole="button"
      accessibilityLabel={t('tracking.settings')}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={styles.gearTarget}
    >
      <View style={[styles.gear, open && styles.gearOpen]}>
        <SettingsIcon
          color={open ? navColors.background : navColors.text}
          size={26}
        />
      </View>
    </Pressable>
  );
}

export function TrackingSettingsPanel({
  choice,
  onChoose,
  onClose,
  onLayout,
}: {
  choice: BrightnessChoice;
  onChoose: (choice: BrightnessChoice) => void;
  onClose: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > SWIPE_CLOSE_PX) onClose();
        },
      }),
    [onClose],
  );
  return (
    <View
      testID="tracking-settings-panel"
      role="dialog"
      accessibilityLabel={t('tracking.settings')}
      onLayout={onLayout}
      style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}
      {...pan.panHandlers}
    >
      <View style={styles.handle} />
      <Text
        accessibilityRole="header"
        style={styles.title}
        maxFontSizeMultiplier={1.2}
      >
        {t('tracking.settings')}
      </Text>
      <Text style={styles.label} maxFontSizeMultiplier={1.2}>
        {t('settings.brightness')}
      </Text>
      <View style={styles.segments}>
        <Segmented
          variant="white"
          accessibilityLabel={t('settings.brightness')}
          value={choice}
          onChange={onChoose}
          options={[
            { value: 'auto', label: t('settings.brightnessAuto') },
            {
              value: 'max',
              label: t('settings.brightnessMax'),
              icon: (color, size) => <SunIcon color={color} size={size} />,
            },
          ]}
        />
      </View>
      <Text style={styles.help} maxFontSizeMultiplier={1.2}>
        <Text style={styles.bold}>{t('settings.brightnessMax')}</Text>
        {t('settings.brightnessHelp')}
      </Text>
      <Pressable
        testID="tracking-settings-close"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.close}
      >
        <Text style={styles.closeText} maxFontSizeMultiplier={1.2}>
          {t('tracking.close')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  gearTarget: {
    position: 'absolute',
    right: 16,
    top: 98,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gear: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: navColors.background,
    borderWidth: 1,
    borderColor: navColors.floatingBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  gearOpen: {
    backgroundColor: navColors.text,
    borderColor: navColors.text,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    backgroundColor: navColors.background,
    borderTopWidth: 3,
    borderTopColor: navColors.text,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: navColors.text2,
  },
  title: {
    marginTop: 18,
    paddingLeft: 4,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    color: navColors.text,
  },
  label: {
    marginTop: 18,
    paddingLeft: 4,
    fontSize: 20,
    fontWeight: '700',
    color: navColors.text,
  },
  segments: { marginTop: 10 },
  help: {
    marginTop: 14,
    paddingLeft: 4,
    fontSize: 20,
    lineHeight: 26,
    color: navColors.text,
  },
  bold: { fontWeight: '700' },
  close: {
    marginTop: 24,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: navColors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 20, fontWeight: '700', color: navColors.text },
});
