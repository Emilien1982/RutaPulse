import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FloatingButton } from './FloatingButton';
import { LocateIcon } from './icons';

describe('FloatingButton', () => {
  it('is a round button of 48 with an accessible name', async () => {
    const onPress = jest.fn();
    await render(
      <FloatingButton
        accessibilityLabel="Recentrer"
        onPress={onPress}
        icon={(color) => <LocateIcon color={color} />}
      />,
    );
    const button = screen.getByRole('button', { name: 'Recentrer' });
    const style = StyleSheet.flatten(button.props.style) as {
      width: number;
      height: number;
    };
    expect(style.width).toBeGreaterThanOrEqual(48);
    expect(style.height).toBeGreaterThanOrEqual(48);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
