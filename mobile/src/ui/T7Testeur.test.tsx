import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SwitchRow } from './SwitchRow';
import { text } from './theme';

// B1: app.json, forced light theme.
describe('B1 light theme', () => {
  it('forces userInterfaceStyle to light', () => {
    const appJson = require('../../app.json') as {
      expo: { userInterfaceStyle: string };
    };
    expect(appJson.expo.userInterfaceStyle).toBe('light');
  });
});

describe('B2 switch row', () => {
  it('centers the switch on the label axis', async () => {
    await render(<SwitchRow label="Wi-Fi" value onValueChange={() => {}} />);
    const row = StyleSheet.flatten(
      screen.getByRole('switch').props.style as never,
    ) as { alignItems: string; minHeight: number; flexDirection: string };
    expect(row.flexDirection).toBe('row');
    expect(row.alignItems).toBe('center');
    expect(row.minHeight).toBe(56);
    // The wrapper of the native switch is as tall as the row and centers it.
    const json = JSON.stringify(screen.toJSON());
    expect(json).toMatch(
      /"height":56,"justifyContent":"center"|"justifyContent":"center","height":56/,
    );
  });
});

describe('B3 Jost line heights', () => {
  const jost = Object.entries(text).filter(
    ([, s]) => (s as { fontFamily?: string }).fontFamily === 'Jost',
  );
  it('finds the Jost styles', () => {
    expect(jost.length).toBeGreaterThanOrEqual(5);
  });
  it.each(jost)('%s: line height >= 1.45 x size', (_n, s) => {
    const st = s as { fontSize: number; lineHeight: number };
    expect(st.lineHeight).toBeGreaterThanOrEqual(st.fontSize * 1.45);
  });
  it('gives 38 to the 26 title and 19 to the 13 label', () => {
    expect(text.titleScreen.lineHeight).toBeGreaterThanOrEqual(37.7);
    expect(text.sectionLabel.lineHeight).toBeGreaterThanOrEqual(18.85);
  });
});
