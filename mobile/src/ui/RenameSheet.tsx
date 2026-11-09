// The "Renommer" sheet (mockup 40, state 4): a bottom sheet over the keyboard.
// The name is selected when it opens, so that typing replaces it. The field
// takes 60 characters at most (counted as displayed characters).

import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { t } from '@/core/i18n/t';
import {
  checkName,
  MAX_NAME_LENGTH,
  normalizeName,
} from '@/core/routes/routeName';

import { Button } from './Button';
import { SignalMark } from './SignalMark';
import { CloseIcon } from './icons';
import { border, colors, radius, spacing, target, text } from './theme';

const FOCUS_AGAIN_MS = 350;

type Props = {
  initialName: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

/**
 * Cuts a text to 60 displayed characters, counted on the normalized name like
 * the counter (a pasted name is cut).
 */
function cut(value: string): string {
  const chars = [...normalizeName(value)];
  return chars.length > MAX_NAME_LENGTH
    ? chars.slice(0, MAX_NAME_LENGTH).join('').trim()
    : value;
}

export function RenameSheet({ initialName, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialName);
  const input = useRef<{ focus: () => void; blur: () => void } | null>(null);
  // `autoFocus` alone leaves the keyboard closed on Android when this Modal
  // opens just after the menu's Modal: focus again once that one has gone.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const timer = setTimeout(() => {
      // Already focused, `focus()` alone asks nothing of the keyboard.
      input.current?.blur();
      input.current?.focus();
    }, FOCUS_AGAIN_MS);
    return () => clearTimeout(timer);
  }, []);
  const check = checkName(value);
  // The name as it will be kept: the same count as the rule of the empty name.
  const count = [...normalizeName(value)].length;
  const empty = !check.ok;

  function submit() {
    if (check.ok) onSubmit(check.name);
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable
          testID="rename-backdrop"
          accessible={false}
          style={styles.backdrop}
          onPress={onCancel}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={text.titleName}>
            {t('routes.renameTitle')}
          </Text>
          <Text style={[text.control, styles.label]}>
            {t('routes.renameField')}
          </Text>
          <View style={[styles.field, empty && styles.fieldError]}>
            <TextInput
              ref={(node) => {
                input.current = node;
              }}
              testID="rename-input"
              accessibilityLabel={t('routes.renameField')}
              value={value}
              onChangeText={(v) => setValue(cut(v))}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              style={[text.body, styles.input]}
            />
            {value !== '' && (
              <Pressable
                testID="rename-clear"
                accessibilityRole="button"
                accessibilityLabel={t('routes.renameClear')}
                onPress={() => setValue('')}
                style={styles.clear}
              >
                <CloseIcon color={colors.brown} />
              </Pressable>
            )}
          </View>
          <View style={styles.help}>
            {empty ? (
              <View style={styles.errorRow}>
                <SignalMark filled testID="rename-error-icon" />
                <Text
                  testID="rename-error"
                  accessibilityRole="alert"
                  style={[text.secondary, styles.error]}
                >
                  {t('routes.renameEmpty')}
                </Text>
              </View>
            ) : count >= MAX_NAME_LENGTH ? (
              <Text testID="rename-max" style={text.secondary}>
                {t('routes.renameMax')}
              </Text>
            ) : (
              <View />
            )}
            <Text
              testID="rename-count"
              style={[
                text.secondary,
                count >= MAX_NAME_LENGTH && styles.countFull,
              ]}
            >
              {t('routes.renameCount', { n: count })}
            </Text>
          </View>
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button
                testID="rename-cancel"
                variant="secondary"
                label={t('routes.renameCancel')}
                onPress={onCancel}
              />
            </View>
            <View style={styles.button}>
              <Button
                testID="rename-submit"
                label={t('routes.renameAction')}
                disabled={empty}
                onPress={submit}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  label: { marginTop: spacing.s3, marginBottom: 6 },
  field: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    backgroundColor: colors.creamLight,
    borderWidth: border.normal,
    borderColor: colors.brown,
    borderRadius: radius.box,
  },
  fieldError: { borderWidth: border.strong, borderColor: colors.danger },
  input: { flex: 1, padding: 0 },
  clear: {
    width: target.stop,
    height: target.stop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: {
    minHeight: 24,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countFull: { color: colors.brown, fontWeight: '700' },
  errorRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  error: { color: colors.danger, fontWeight: '700', flex: 1 },
  buttons: { flexDirection: 'row', gap: spacing.s3, marginTop: spacing.s3 },
  button: { flex: 1 },
});
