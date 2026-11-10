// The "⋮" menu of a saved route on Android: a bottom sheet (ADR 0020, section
// 7 bis). `Alert.alert` takes 3 buttons at most there, and the menu has 4
// actions. It closes with "Annuler", a touch outside the sheet, or the Back
// key. Same look as the "Renommer" sheet.

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/t';

import { Button } from './Button';
import { border, colors, radius, spacing, target, text } from './theme';

export type MenuEntry = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  title: string;
  entries: MenuEntry[];
  onClose: () => void;
};

export function ActionMenuSheet({ title, entries, onClose }: Props) {
  return (
    <Modal
      testID="menu-modal"
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          testID="menu-backdrop"
          accessible={false}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[text.titleName, styles.title]}
          >
            {title}
          </Text>
          {entries.map((entry) => (
            <Pressable
              key={entry.key}
              testID={`menu-${entry.key}`}
              accessibilityRole="button"
              accessibilityLabel={entry.label}
              onPress={() => {
                onClose();
                entry.onPress();
              }}
              android_ripple={{ color: colors.sand, foreground: true }}
              style={styles.entry}
            >
              <Text
                style={[
                  text.buttonAction,
                  { color: entry.destructive ? colors.danger : colors.brown },
                ]}
              >
                {entry.label}
              </Text>
            </Pressable>
          ))}
          <View style={styles.cancel}>
            <Button
              testID="menu-cancel"
              variant="secondary"
              label={t('routes.menuCancel')}
              onPress={onClose}
            />
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
  title: { marginBottom: spacing.s2 },
  entry: { minHeight: target.mainButton, justifyContent: 'center' },
  cancel: { marginTop: spacing.s3 },
});
