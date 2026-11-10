// The "⋮" menu of a saved route (ADR 0019, section 13, point 4; ADR 0020,
// section 7 bis), with no new module: the native action sheet on iOS. On
// Android, `Alert.alert` takes 3 buttons at most and the menu has 4 actions:
// `openSheet` shows the bottom sheet of `ActionMenuSheet` instead.

import { ActionSheetIOS, Platform } from 'react-native';

import { t } from '@/core/i18n/t';

export type RouteMenuActions = {
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
};

export function openActionMenu(
  name: string,
  { onRename, onDuplicate, onExport, onDelete }: RouteMenuActions,
  openSheet: () => void,
): void {
  if (Platform.OS !== 'ios') {
    openSheet();
    return;
  }
  const handlers = [onRename, onDuplicate, onExport, onDelete];
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: name,
      options: [
        t('routes.menuRename'),
        t('routes.menuDuplicate'),
        t('routes.menuExport'),
        t('routes.menuDelete'),
        t('routes.menuCancel'),
      ],
      destructiveButtonIndex: 3,
      cancelButtonIndex: 4,
    },
    (index) => handlers[index]?.(),
  );
}
