import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { mapColors } from '@/ui/theme';

import { ActionMenuSheet } from './ActionMenuSheet';
import { RoutePreview } from './RoutePreview';

describe('T9 M3: the Android menu sheet', () => {
  it('every entry is 56 high', async () => {
    await render(
      <ActionMenuSheet
        title="Sortie"
        entries={[
          { key: 'rename', label: 'Renommer', onPress: jest.fn() },
          { key: 'delete', label: 'Supprimer', onPress: jest.fn() },
        ]}
        onClose={jest.fn()}
      />,
    );
    const entry = screen.getByTestId('menu-rename');
    expect(StyleSheet.flatten(entry.props.style).minHeight).toBe(56);
  });
});

describe('T9 M8: the start is drawn after the arrival', () => {
  it('the green round comes last in the SVG, so it stays above', async () => {
    const loop = [
      [6.1, 48.6],
      [6.2, 48.7],
      [6.1, 48.6],
    ];
    const { toJSON } = await render(
      <RoutePreview track={loop} width={100} height={100} />,
    );
    const fills: number[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const n = node as { props?: Record<string, unknown>; children?: unknown };
      if (n.props && 'cx' in n.props)
        fills.push((n.props.fill as { payload: number }).payload & 0xffffff);
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    walk(toJSON());
    expect(fills.length).toBe(2);
    const start = parseInt(mapColors.start.slice(1), 16);
    expect(fills[0]).not.toBe(start);
    expect(fills[1]).toBe(start);
  });
});
