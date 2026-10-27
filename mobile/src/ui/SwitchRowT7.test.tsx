import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SwitchRow } from './SwitchRow';
import { text } from './theme';

describe('T7 fixes in ui', () => {
  it('B2: the switch sits in a box as tall as the row, centered', async () => {
    await render(<SwitchRow label="Wi-Fi" value onValueChange={() => {}} />);
    const row = screen.getByRole('switch');
    const box = row.children[row.children.length - 1] as unknown as {
      props: { style: unknown };
    };
    const style = StyleSheet.flatten(box.props.style as never) as {
      height: number;
      justifyContent: string;
    };
    expect(style.height).toBe(56);
    expect(style.justifyContent).toBe('center');
  });

  it('B3: Jost styles have a line height of at least 1.45 times the size', () => {
    for (const style of [
      text.titleScreen,
      text.titleState,
      text.titleName,
      text.buttonAction,
      text.sectionLabel,
    ]) {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize * 1.45);
    }
  });
});
