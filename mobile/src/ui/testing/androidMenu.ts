// Tests: the entries of the bottom sheet that is the "⋮" menu on Android
// (ADR 0020, section 7 bis), found by their texts in the rendered screen.

import { fireEvent, screen } from '@testing-library/react-native';

export type MenuKey = 'rename' | 'duplicate' | 'export' | 'delete';

/** The same shape as the buttons of `Alert.alert`, for `press()` helpers. */
export function menuEntry(key: MenuKey) {
  return {
    onPress: () => {
      void fireEvent.press(screen.getByTestId(`menu-${key}`));
    },
  };
}

/** The texts of the entries, in the order of the rendered sheet, without "Annuler". */
export function menuTexts(): string[] {
  return screen
    .queryAllByRole('button')
    .filter((node) => /^menu-(?!cancel$)/.test(String(node.props.testID)))
    .map((node) => String(node.props.accessibilityLabel ?? ''));
}
