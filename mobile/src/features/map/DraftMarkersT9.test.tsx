// T9, B1: on a loop the start is drawn above the arrival. On iOS the last
// annotation is the top one, on Android the first.
import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DraftMarkers, type MarkerHandlers } from './DraftMarkers';

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Marker: () => null,
    ViewAnnotation: (props: { id: string; children: React.ReactNode }) => (
      <View testID={`annotation:${props.id}`}>{props.children}</View>
    ),
  };
});

const handlers: MarkerHandlers = {
  onChoose: jest.fn(),
  onDragStart: jest.fn(),
  onDrag: jest.fn(),
  onDragEnd: jest.fn(),
  onGone: jest.fn(),
};
const A = { id: 1, lon: 6.1, lat: 48.6 };
const B = { id: 2, lon: 6.2, lat: 48.7 };
const C = { id: 3, lon: 6.3, lat: 48.6 };
const LOOP = [A, B, C, { id: 4, lon: 6.1, lat: 48.6 }];

const original = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: original });
});

async function drawn(os: 'ios' | 'android', points: typeof LOOP) {
  Object.defineProperty(Platform, 'OS', { value: os });
  await render(
    <DraftMarkers
      points={points}
      chosenId={null}
      refusedId={null}
      handlers={handlers}
    />,
  );
  return screen
    .getAllByTestId(/^annotation:/)
    .map((node) => String(node.props.testID).split('-').pop());
}

describe('B1: the start of a loop above the arrival', () => {
  it('iOS: the start is the last annotation of a loop', async () => {
    expect(await drawn('ios', LOOP)).toEqual(['2', '3', '4', '1']);
  });

  it('Android: the start stays the first annotation', async () => {
    expect(await drawn('android', LOOP)).toEqual(['1', '2', '3', '4']);
  });

  it('iOS: a route that is not a loop keeps its order', async () => {
    expect(await drawn('ios', [A, B, C])).toEqual(['1', '2', '3']);
  });
});
