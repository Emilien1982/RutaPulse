import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { StripedBanner } from './StripedBanner';
import { Stripes } from './Stripes';

describe('Stripes', () => {
  it('is 9 points tall (three bands of 3)', async () => {
    await render(<Stripes />);
    const style = StyleSheet.flatten(
      screen.getByTestId('stripes').props.style,
    ) as { height: number };
    expect(style.height).toBe(9);
  });
});

describe('StripedBanner', () => {
  it('is 200 points tall', async () => {
    await render(<StripedBanner />);
    const style = StyleSheet.flatten(
      screen.getByTestId('striped-banner').props.style,
    ) as { height: number };
    expect(style.height).toBe(200);
  });
});
