import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RouteBubble, RouteTopBar } from './RouteSheets';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('T9 B2: Enregistrer', () => {
  it('is drawn again when it goes from off to on', async () => {
    const bar = (enabled: boolean) => (
      <RouteTopBar
        onClose={jest.fn()}
        onHeight={jest.fn()}
        onSave={{ enabled, press: jest.fn() }}
        saveLabel="Enregistrer"
        saveOffLabel="Enregistrer, pas encore"
      />
    );
    const view = await render(bar(false));
    const off = screen.getByTestId('route-save');
    await view.rerender(bar(true));
    expect(screen.getByTestId('route-save')).not.toBe(off);
  });
});

describe('T9 M1: the bubble', () => {
  it('is 344 wide at most, 16 from the edges, with a centered text', async () => {
    await render(<RouteBubble top={120} label="Un texte" testID="bubble" />);
    const bubble = StyleSheet.flatten(screen.getByTestId('bubble').props.style);
    expect(bubble.maxWidth).toBe(344);
    expect(bubble.marginHorizontal).toBe(16);
    const text = StyleSheet.flatten(screen.getByText('Un texte').props.style);
    expect(text.textAlign).toBe('center');
  });
});
