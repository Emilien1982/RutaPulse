// Android: the keyboard did not open when the "Renommer" sheet came right
// after the menu sheet (two Modals in a row). The field asks for the focus
// again once the first Modal has gone. iOS does not need it (and would
// flicker): nothing there.
import { act, render, screen } from '@testing-library/react-native';
import { Platform, TextInput } from 'react-native';

import { RenameSheet } from './RenameSheet';

const original = Platform.OS;
const setOs = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

afterEach(() => {
  setOs(original as 'ios' | 'android');
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function spies() {
  const proto = (
    TextInput as unknown as {
      prototype: { focus: () => void; blur: () => void };
    }
  ).prototype;
  const focus = jest.spyOn(proto, 'focus');
  const blur = jest.spyOn(proto, 'blur');
  // The mocked methods are shared by every test: count from zero.
  focus.mockClear();
  blur.mockClear();
  return { focus, blur };
}

const open = () =>
  render(
    <RenameSheet initialName="A" onSubmit={jest.fn()} onCancel={jest.fn()} />,
  );

it('Android: blurs then focuses the field again after the opening, not after it closed', async () => {
  setOs('android');
  jest.useFakeTimers();
  const { focus, blur } = spies();
  const { unmount } = await open();
  expect(screen.getByTestId('rename-input').props.autoFocus).toBe(true);
  const before = focus.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(focus.mock.calls.length).toBe(before + 1);
  expect(blur).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(focus.mock.calls.length).toBe(before + 1);
});

it('iOS: no blur and no second focus', async () => {
  setOs('ios');
  jest.useFakeTimers();
  const { focus, blur } = spies();
  await open();
  const before = focus.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(focus.mock.calls.length).toBe(before);
  expect(blur).not.toHaveBeenCalled();
});
