// The menu of a saved route with 4 actions (ADR 0020, section 7 bis): the
// bottom sheet of Android, from the "⋮" and from the long press.

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Platform, Pressable, Text } from 'react-native';

import { useRouteMenu, type RouteMenuHandlers } from './useRouteMenu';

const original = Platform.OS;
function setOs(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}
afterEach(() => {
  setOs(original as 'ios' | 'android');
  jest.restoreAllMocks();
});

function handlers(): RouteMenuHandlers {
  return {
    rename: jest.fn().mockResolvedValue(true),
    remove: jest.fn().mockResolvedValue(true),
    duplicate: jest.fn().mockResolvedValue(null),
    export: jest.fn(),
  };
}

function Host({ h }: { h: RouteMenuHandlers }) {
  const menu = useRouteMenu(h);
  const route = { id: 7, name: 'Boucle' };
  return (
    <>
      <Pressable testID="dots" onPress={() => menu.open(route)}>
        <Text>dots</Text>
      </Pressable>
      <Pressable testID="long" onLongPress={() => menu.open(route)}>
        <Text>long</Text>
      </Pressable>
      {menu.sheet}
    </>
  );
}

describe('menu on Android', () => {
  beforeEach(() => setOs('android'));

  it.each([
    ['the "⋮"', () => fireEvent.press(screen.getByTestId('dots'))],
    ['a long press', () => fireEvent(screen.getByTestId('long'), 'longPress')],
  ])('opens from %s with 4 entries in order, then "Annuler"', async (_, go) => {
    await render(<Host h={handlers()} />);
    expect(screen.queryByTestId('menu-cancel')).toBeNull();
    await go();
    const keys = screen
      .getAllByRole('button')
      .map((b) => b.props.testID as string)
      .filter((id) => id?.startsWith('menu-') && id !== 'menu-backdrop');
    expect(keys).toEqual([
      'menu-rename',
      'menu-duplicate',
      'menu-export',
      'menu-delete',
      'menu-cancel',
    ]);
    expect(screen.getByText('Dupliquer')).toBeTruthy();
  });

  it('closes with "Annuler", with a touch outside and with the Back key', async () => {
    await render(<Host h={handlers()} />);
    await fireEvent.press(screen.getByTestId('dots'));
    await fireEvent.press(screen.getByTestId('menu-cancel'));
    expect(screen.queryByTestId('menu-cancel')).toBeNull();

    await fireEvent.press(screen.getByTestId('dots'));
    await fireEvent.press(
      screen.getByTestId('menu-backdrop', { includeHiddenElements: true }),
    );
    expect(screen.queryByTestId('menu-cancel')).toBeNull();

    await fireEvent.press(screen.getByTestId('dots'));
    await act(async () => {
      screen.getByTestId('menu-modal').props.onRequestClose();
    });
    expect(screen.queryByTestId('menu-cancel')).toBeNull();
  });

  it('runs "Dupliquer" with the id and closes the sheet', async () => {
    const h = handlers();
    await render(<Host h={h} />);
    await fireEvent.press(screen.getByTestId('dots'));
    await fireEvent.press(screen.getByTestId('menu-duplicate'));
    expect(h.duplicate).toHaveBeenCalledWith(7);
    expect(screen.queryByTestId('menu-cancel')).toBeNull();
  });

  it('opens the rename sheet from "Renommer"', async () => {
    await render(<Host h={handlers()} />);
    await fireEvent.press(screen.getByTestId('dots'));
    await fireEvent.press(screen.getByTestId('menu-rename'));
    expect(screen.getByTestId('rename-input')).toBeTruthy();
    expect(screen.queryByTestId('menu-cancel')).toBeNull();
  });
});

describe('menu on iOS', () => {
  it('runs "Dupliquer" from the action sheet', async () => {
    setOs('ios');
    let choose: (index: number) => void = () => undefined;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_, callback) => {
        choose = callback;
      });
    const h = handlers();
    await render(<Host h={h} />);
    await fireEvent.press(screen.getByTestId('dots'));
    choose(1);
    expect(h.duplicate).toHaveBeenCalledWith(7);
    expect(screen.queryByTestId('menu-cancel')).toBeNull();
  });
});
