import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SwitchRow } from './SwitchRow';

describe('SwitchRow', () => {
  it('is a switch with its label and its state', async () => {
    await render(<SwitchRow label="Wi-Fi" value onValueChange={() => {}} />);
    const row = screen.getByRole('switch', { name: 'Wi-Fi' });
    expect(row.props.accessibilityState).toEqual({ checked: true });
  });

  it('is at least 48 tall', async () => {
    await render(<SwitchRow label="Wi-Fi" value onValueChange={() => {}} />);
    const style = StyleSheet.flatten(
      screen.getByRole('switch').props.style,
    ) as { minHeight: number };
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('asks for the opposite value when pressed', async () => {
    const onValueChange = jest.fn();
    await render(
      <SwitchRow label="Wi-Fi" value onValueChange={onValueChange} />,
    );
    await fireEvent.press(screen.getByRole('switch', { name: 'Wi-Fi' }));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });
});
