// The actions of a saved route, for the list and for its Infos screen: the
// "⋮" menu, the "Renommer" sheet and the confirmation of "Supprimer" (mockup
// 40, states 3, 4 and 5). The caller gives the writes; this folder does not
// read the database.

import { useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { t } from '@/core/i18n/t';

import { openActionMenu } from './openActionMenu';
import { RenameSheet } from './RenameSheet';

export type RouteMenuHandlers = {
  rename: (id: number, name: string) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
  /** Export is made in T6: without it, the entry does nothing. */
  export?: (id: number) => void;
  /** After a deletion. */
  onRemoved?: (id: number) => void;
};

type Target = { id: number; name: string };

function failed() {
  Alert.alert(t('routes.actionFailedTitle'), t('routes.actionFailedText'));
}

/** `sheet` must be rendered by the screen, once. */
export function useRouteMenu(handlers: RouteMenuHandlers): {
  open: (route: Target) => void;
  sheet: ReactNode;
} {
  const [renaming, setRenaming] = useState<Target | null>(null);

  function confirmRemove({ id, name }: Target) {
    Alert.alert(t('routes.deleteTitle', { name }), t('routes.deleteText'), [
      { text: t('zones.deleteCancel'), style: 'cancel' },
      {
        text: t('zones.delete'),
        style: 'destructive',
        onPress: () => {
          handlers
            .remove(id)
            .then(() => handlers.onRemoved?.(id))
            .catch(failed);
        },
      },
    ]);
  }

  function open(route: Target) {
    openActionMenu(route.name, {
      onRename: () => setRenaming(route),
      onExport: () => handlers.export?.(route.id),
      onDelete: () => confirmRemove(route),
    });
  }

  const sheet = renaming && (
    <RenameSheet
      key={renaming.id}
      initialName={renaming.name}
      onCancel={() => setRenaming(null)}
      onSubmit={(name) => {
        const { id } = renaming;
        setRenaming(null);
        handlers.rename(id, name).catch(failed);
      }}
    />
  );
  return { open, sheet };
}
