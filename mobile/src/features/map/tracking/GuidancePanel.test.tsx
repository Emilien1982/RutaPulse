// The panel (mockup 30): the instruction drops the kind of way when a line is
// shown below it (note of the mockup, decision C4 of the T3 comparison).
import { render, screen } from '@testing-library/react-native';

import type { Panel } from '@/core/tracking/trackingState';

import { GuidancePanel } from './GuidancePanel';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

const turn: Panel = {
  kind: 'turn',
  distanceM: 170,
  direction: {
    kind: 'turn',
    atM: 500,
    gesture: 'slight',
    side: 'right',
    way: 'track',
  },
  reason: null,
  imminent: false,
  gpsLost: false,
  silent: false,
};

describe('GuidancePanel', () => {
  it('shows the kind of way when there is no line below', async () => {
    await render(<GuidancePanel panel={turn} />);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      'Légèrement à droite sur la piste',
    );
    expect(screen.queryByTestId('tracking-note')).toBeNull();
  });

  it('drops the kind of way, on one line, when "Signal GPS perdu" is shown', async () => {
    await render(<GuidancePanel panel={{ ...turn, gpsLost: true }} />);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      /^Légèrement à droite$/,
    );
    expect(screen.getByTestId('tracking-instruction')).toHaveProp(
      'numberOfLines',
      1,
    );
    expect(screen.getByTestId('tracking-note')).toHaveTextContent(
      'Signal GPS perdu',
    );
  });

  it('drops the kind of way of both turns of a pair', async () => {
    const pair: Panel = {
      ...turn,
      gpsLost: true,
      direction: {
        kind: 'turn',
        atM: 500,
        gesture: 'turn',
        side: 'left',
        way: 'road',
        then: { gesture: 'turn', side: 'right', way: 'track' },
      },
    };
    await render(<GuidancePanel panel={pair} />);
    expect(screen.getByTestId('tracking-instruction')).toHaveTextContent(
      'Tournez à gauche, puis à droite',
    );
  });
});
