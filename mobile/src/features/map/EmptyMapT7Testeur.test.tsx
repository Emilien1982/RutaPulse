import { render, screen } from '@testing-library/react-native';

import { EmptyMap } from './EmptyMap';

describe('B4 empty state', () => {
  it('has the cyclist, the bike, the title and the button', async () => {
    const onChoose = jest.fn();
    await render(<EmptyMap onChooseZone={onChoose} />);
    expect(screen.getByText('Pas encore de carte')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Choisir une zone' }),
    ).toBeTruthy();
    const json = JSON.stringify(screen.toJSON());
    for (const name of ['vetetiste', 'velo', 'sol', 'buste', 'bras', 'jambe']) {
      expect(json).toContain(`"name":"${name}"`);
    }
  });
});
