// The end screen (mockup v1/60; spec C6, C7).
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { RideSummary } from './RideSummary';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

const onClose = jest.fn();
beforeEach(() => jest.clearAllMocks());

function show(props: Partial<React.ComponentProps<typeof RideSummary>> = {}) {
  return render(
    <RideSummary
      arrived
      distanceM={25_640}
      durationS={112 * 60}
      ascentM={433}
      onClose={onClose}
      {...props}
    />,
  );
}

describe('RideSummary', () => {
  it('says "ARRIVÉE !" with the real figures', async () => {
    await show({ name: 'Boucle du Bois de la Côte' });
    expect(screen.getByText('ARRIVÉE !')).toBeOnTheScreen();
    expect(screen.getByText('Boucle du Bois de la Côte')).toBeOnTheScreen();
    expect(screen.getByText('Distance parcourue')).toBeOnTheScreen();
    expect(screen.getByTestId('ride-distance')).toHaveTextContent('25,6 km');
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('433 m');
    expect(screen.getByTestId('ride-duration')).toHaveTextContent('1 h 52');
    expect(
      screen.getByText('Le suivi est arrêté.', { exact: false }),
    ).toBeOnTheScreen();
  });

  it('says "SORTIE TERMINÉE" when the ride was finished', async () => {
    await show({ arrived: false });
    expect(screen.getByText('SORTIE TERMINÉE')).toBeOnTheScreen();
    expect(screen.queryByText('ARRIVÉE !')).toBeNull();
  });

  it('shows "…" while the ascent is awaited, then the value', async () => {
    const view = await show({ ascentM: undefined });
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('…');
    await view.rerender(
      <RideSummary
        arrived
        distanceM={25_640}
        durationS={6720}
        ascentM={1250}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('1 250 m');
  });

  it('shows "—" when the ascent is unknown', async () => {
    await show({ ascentM: null });
    expect(screen.getByTestId('ride-ascent')).toHaveTextContent('—');
  });

  it('has one button, "Fermer"', async () => {
    await show();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByText('Fermer'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rounds under 1 km to 10 m', async () => {
    const view = await show({ distanceM: 437 });
    expect(screen.getByTestId('ride-distance')).toHaveTextContent('440 m');
    await view.rerender(
      <RideSummary
        arrived
        distanceM={995}
        durationS={600}
        ascentM={1}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('ride-distance')).toHaveTextContent('1,0 km');
  });

  it('draws "…" and "—" in the size of the figures', async () => {
    const view = await show({ ascentM: undefined });
    const size = () =>
      StyleSheet.flatten(screen.getByText('…').props.style).fontSize;
    expect(size()).toBe(36);
    await view.rerender(
      <RideSummary
        arrived
        distanceM={500}
        durationS={600}
        ascentM={null}
        onClose={onClose}
      />,
    );
    expect(StyleSheet.flatten(screen.getByText('—').props.style).fontSize).toBe(
      36,
    );
  });

  it('is read "Arrivée" or "Sortie terminée"', async () => {
    const view = await show();
    expect(screen.getByRole('header')).toHaveAccessibleName('Arrivée');
    await view.rerender(
      <RideSummary
        arrived={false}
        distanceM={500}
        durationS={600}
        ascentM={1}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('header')).toHaveAccessibleName('Sortie terminée');
  });
});
