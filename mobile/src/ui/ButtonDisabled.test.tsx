// The off button (mockup 40, "Bouton inactif en tirets brun-2, pas en
// transparence"): light cream, dashed brown-2 border, brown-2 text, no
// opacity (B2 of the T8 comparison).
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { useEffect } from 'react';

import { Button } from './Button';
import { border, colors } from './theme';

const style = () =>
  StyleSheet.flatten(screen.getByRole('button').props.style) as Record<
    string,
    unknown
  >;

describe.each(['primary', 'secondary', 'download'] as const)(
  'disabled Button (%s)',
  (variant) => {
    it('is dashed brown-2 on light cream, without opacity', async () => {
      await render(
        <Button
          label="Renommer"
          variant={variant}
          disabled
          onPress={() => {}}
        />,
      );
      expect(style()).toMatchObject({
        backgroundColor: colors.creamLight,
        borderWidth: border.normal,
        borderStyle: 'dashed',
        borderColor: colors.brown2,
      });
      expect(style().opacity).toBeUndefined();
      expect(
        StyleSheet.flatten(screen.getByText('Renommer').props.style).color,
      ).toBe(colors.brown2);
    });

    it('keeps its look when enabled', async () => {
      await render(
        <Button label="Renommer" variant={variant} onPress={() => {}} />,
      );
      expect(style().borderStyle).not.toBe('dashed');
      expect(style().opacity).toBeUndefined();
    });
  },
);

it('is drawn again (another key) when it turns on or off', async () => {
  let mounts = 0;
  function Mark() {
    useEffect(() => {
      mounts += 1;
    }, []);
    return <Text>i</Text>;
  }
  const button = (disabled: boolean) => (
    <Button
      label="Go"
      disabled={disabled}
      icon={() => <Mark />}
      onPress={() => {}}
    />
  );
  const view = await render(button(false));
  expect(mounts).toBe(1);
  await view.rerender(button(true));
  expect(mounts).toBe(2);
  await view.rerender(button(true));
  expect(mounts).toBe(2);
});
