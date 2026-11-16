// ADR 0021, section 8.6: a drag of the panel downward closes it.
import { render, screen } from '@testing-library/react-native';

import { TrackingSettingsPanel } from './TrackingSettingsPanel';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// PanResponder reads `touchHistory`: a start at (100, 500) and the current point.
function touch(pageY: number, pageX = 100, stamp = 2) {
  const start = { x: 100, y: 500 };
  return {
    touchHistory: {
      indexOfSingleActiveTouch: 1,
      mostRecentTimeStamp: stamp,
      numberActiveTouches: 1,
      touchBank: [
        undefined,
        {
          touchActive: true,
          startPageX: start.x,
          startPageY: start.y,
          startTimeStamp: 1,
          currentPageX: pageX,
          currentPageY: pageY,
          currentTimeStamp: stamp,
          previousPageX: start.x,
          previousPageY: start.y,
          previousTimeStamp: 1,
        },
      ],
    },
    nativeEvent: { touches: [{}], changedTouches: [{}] },
  };
}

async function drag(toY: number, toX = 100) {
  const onClose = jest.fn();
  await render(
    <TrackingSettingsPanel
      choice="auto"
      onChoose={jest.fn()}
      onClose={onClose}
      onLayout={jest.fn()}
    />,
  );
  const panel = screen.getByTestId('tracking-settings-panel');
  // The order of the responder system: capture, should-set, grant, move, release.
  panel.props.onMoveShouldSetResponderCapture(touch(toY, toX, 3));
  panel.props.onMoveShouldSetResponder(touch(toY, toX, 3));
  panel.props.onResponderGrant(touch(toY, toX, 3));
  panel.props.onResponderMove(touch(toY, toX, 4));
  panel.props.onResponderRelease(touch(toY, toX, 4));
  return onClose;
}

describe('swipe down on the panel of settings', () => {
  it('closes after a long drag downward', async () => {
    const onClose = await drag(620);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('does not close after a short drag', async () => {
    const onClose = await drag(510);
    expect(onClose).not.toHaveBeenCalled();
  });
});
