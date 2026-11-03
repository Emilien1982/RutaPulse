// The "⋮" menu of a saved route (ADR 0019, section 13, point 4), with the
// native boxes of React Native and no new module: an action sheet on iOS, a
// dialog with the three actions on Android (its maximum of buttons).

import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { t } from '@/core/i18n/t';

export type RouteMenuActions = {
  onRename: () => void;
  onExport: () => void;
  onDelete: () => void;
};

export function openActionMenu(
  name: string,
  { onRename, onExport, onDelete }: RouteMenuActions,
): void {
  if (Platform.OS === 'ios') {
    const handlers = [onRename, onExport, onDelete];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: name,
        options: [
          t('routes.menuRename'),
          t('routes.menuExport'),
          t('routes.menuDelete'),
          t('routes.menuCancel'),
        ],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      },
      (index) => handlers[index]?.(),
    );
    return;
  }
  Alert.alert(
    name,
    undefined,
    [
      { text: t('routes.menuRename'), onPress: onRename },
      { text: t('routes.menuExport'), onPress: onExport },
      {
        text: t('routes.menuDelete'),
        style: 'destructive',
        onPress: onDelete,
      },
    ],
    { cancelable: true },
  );
}
