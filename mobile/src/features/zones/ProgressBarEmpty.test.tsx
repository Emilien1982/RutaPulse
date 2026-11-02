import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ProgressBar } from './ProgressBar';

describe('ProgressBar fill edge', () => {
  it('has no right edge at 0 %', async () => {
    await render(<ProgressBar label="x" done={0} total={100} />);
    const fill = screen.getByRole('progressbar').children[0] as never as {
      props: { style: unknown };
    };
    const style = StyleSheet.flatten(fill.props.style as never) as {
      borderRightWidth?: number;
    };
    expect(style.borderRightWidth ?? 0).toBe(0);
  });

  it('keeps the right edge above 0 %', async () => {
    await render(<ProgressBar label="x" done={40} total={100} />);
    const fill = screen.getByRole('progressbar').children[0] as never as {
      props: { style: unknown };
    };
    const style = StyleSheet.flatten(fill.props.style as never) as {
      borderRightWidth?: number;
    };
    expect(style.borderRightWidth).toBe(2);
  });
});
