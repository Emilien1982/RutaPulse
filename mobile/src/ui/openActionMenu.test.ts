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
  return {
    onRename: jest.fn(),
    onDuplicate: jest.fn(),
    onExport: jest.fn(),
    onDelete: jest.fn(),
  };
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
    openActionMenu('Boucle', actions(), jest.fn());
    expect(alert).not.toHaveBeenCalled();
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(sheet.mock.calls[0]![0]).toMatchObject({
      title: 'Boucle',
      options: [
        'Renommer',
        'Dupliquer',
        'Exporter en GPX',
        'Supprimer',
        'Annuler',
      ],
      destructiveButtonIndex: 3,
      cancelButtonIndex: 4,
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
    openActionMenu('Boucle', a, jest.fn());
    choose(2);
    expect(a.onExport).toHaveBeenCalledTimes(1);
    choose(0);
    choose(1);
    choose(3);
    choose(4);
    expect(a.onRename).toHaveBeenCalledTimes(1);
    expect(a.onDuplicate).toHaveBeenCalledTimes(1);
    expect(a.onDelete).toHaveBeenCalledTimes(1);
    expect(a.onExport).toHaveBeenCalledTimes(1);
  });
});

describe('openActionMenu on Android', () => {
  it('opens the bottom sheet, with no Alert and no action sheet', () => {
    setOs('android');
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions');
    const openSheet = jest.fn();
    const a = actions();
    openActionMenu('Boucle', a, openSheet);
    expect(openSheet).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    expect(sheet).not.toHaveBeenCalled();
    expect(a.onRename).not.toHaveBeenCalled();
  });
});
