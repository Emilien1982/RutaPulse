import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { openActionMenu } from './openActionMenu';

const original = Platform.OS;
function setOs(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}
afterEach(() => {
  setOs(original as 'ios' | 'android');
  jest.restoreAllMocks();
});

function actions() {
  return { onRename: jest.fn(), onExport: jest.fn(), onDelete: jest.fn() };
}

describe('openActionMenu on iOS', () => {
  it('opens an action sheet with a red "Supprimer" and "Annuler"', () => {
    setOs('ios');
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => undefined);
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    openActionMenu('Boucle', actions());
    expect(alert).not.toHaveBeenCalled();
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(sheet.mock.calls[0]![0]).toMatchObject({
      title: 'Boucle',
      options: ['Renommer', 'Exporter en GPX', 'Supprimer', 'Annuler'],
      destructiveButtonIndex: 2,
      cancelButtonIndex: 3,
    });
  });

  it('runs the chosen action, and nothing on "Annuler"', () => {
    setOs('ios');
    let choose: (index: number) => void = () => undefined;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_, callback) => {
        choose = callback;
      });
    const a = actions();
    openActionMenu('Boucle', a);
    choose(1);
    expect(a.onExport).toHaveBeenCalledTimes(1);
    choose(0);
    choose(2);
    choose(3);
    expect(a.onRename).toHaveBeenCalledTimes(1);
    expect(a.onDelete).toHaveBeenCalledTimes(1);
    expect(a.onExport).toHaveBeenCalledTimes(1);
  });
});

describe('openActionMenu on Android', () => {
  it('opens a cancelable dialog with exactly the three actions', () => {
    setOs('android');
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions');
    const a = actions();
    openActionMenu('Boucle', a);
    expect(sheet).not.toHaveBeenCalled();
    const [title, , buttons, options] = alert.mock.calls[0]!;
    expect(title).toBe('Boucle');
    expect(buttons!.map((b) => b.text)).toEqual([
      'Supprimer',
      'Exporter en GPX',
      'Renommer',
    ]);
    expect(buttons![0]!.style).toBe('destructive');
    expect(options).toEqual({ cancelable: true });
    buttons![0]!.onPress!();
    buttons![1]!.onPress!();
    buttons![2]!.onPress!();
    expect(a.onRename).toHaveBeenCalledTimes(1);
    expect(a.onExport).toHaveBeenCalledTimes(1);
    expect(a.onDelete).toHaveBeenCalledTimes(1);
  });
});
