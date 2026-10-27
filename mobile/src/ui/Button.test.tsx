import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';

describe('Button', () => {
  it('is a button with its label as accessible name', async () => {
    await render(<Button label="Choisir" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Choisir' })).toBeTruthy();
  });

  it('uses the long accessibility label when given', async () => {
    await render(
      <Button
        label="Télécharger"
        accessibilityLabel="Télécharger la zone Nancy (118 Mo)"
        variant="download"
        onPress={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Télécharger la zone Nancy (118 Mo)',
      }),
    ).toBeTruthy();
  });

  it.each(['primary', 'secondary', 'download'] as const)(
    'has a touch target of at least 48 (%s)',
    async (variant) => {
      await render(<Button label="Ok" variant={variant} onPress={() => {}} />);
      const style = StyleSheet.flatten(
        screen.getByRole('button').props.style,
      ) as { height: number };
      expect(style.height).toBeGreaterThanOrEqual(48);
    },
  );

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Button label="Ok" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ok' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Ok" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ok' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('draws the icon', async () => {
    await render(
      <Button
        label="Ok"
        onPress={() => {}}
        icon={() => <View testID="icon" />}
      />,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });
});
