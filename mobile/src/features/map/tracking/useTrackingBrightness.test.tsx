// What the tracking does to the brightness, by platform (ADR 0021, section
// 8.3). `expo-brightness` is the imitation of jest.setup.js.
import { act, renderHook } from '@testing-library/react-native';
import {
  getBrightnessAsync,
  restoreSystemBrightnessAsync,
  setBrightnessAsync,
} from 'expo-brightness';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import type { BrightnessChoice } from '@/core/tracking/brightness';
import type { TrackingStatus } from '@/core/tracking/trackingState';

import { useTrackingBrightness } from './useTrackingBrightness';

const mockGet = getBrightnessAsync as jest.Mock;
const mockSet = setBrightnessAsync as jest.Mock;
const mockRestore = restoreSystemBrightnessAsync as jest.Mock;

let appListeners: ((state: AppStateStatus) => void)[] = [];

function setPlatform(os: 'ios' | 'android') {
  jest.replaceProperty(Platform, 'OS', os);
}

async function send(state: AppStateStatus) {
  await act(async () => {
    appListeners.forEach((listener) => listener(state));
  });
}

function mount(choice: BrightnessChoice, status: TrackingStatus = 'tracking') {
  return renderHook(
    (props: { choice: BrightnessChoice; status: TrackingStatus }) =>
      useTrackingBrightness(props.choice, props.status),
    { initialProps: { choice, status } },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  appListeners = [];
  mockGet.mockResolvedValue(0.3);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    listener: (state: AppStateStatus) => void,
  ) => {
    appListeners.push(listener);
    return {
      remove: () => (appListeners = appListeners.filter((l) => l !== listener)),
    };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

describe('Android (the window of the app only)', () => {
  beforeEach(() => setPlatform('android'));

  it('touches nothing with "Automatique"', async () => {
    const view = await mount('auto');
    await act(async () => {});
    await view.unmount();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('raises at the start, gives back when the choice goes back to "Automatique"', async () => {
    const view = await mount('max');
    await act(async () => {});
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(1);
    expect(mockGet).not.toHaveBeenCalled();
    await view.rerender({ choice: 'auto', status: 'tracking' });
    await act(async () => {});
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it('raises when the choice changes during the tracking', async () => {
    const view = await mount('auto');
    await view.rerender({ choice: 'max', status: 'tracking' });
    await act(async () => {});
    expect(mockSet).toHaveBeenCalledWith(1);
  });

  it('gives back in the background and raises again when it comes back', async () => {
    const view = await mount('max');
    await act(async () => {});
    await send('inactive');
    expect(mockRestore).not.toHaveBeenCalled();
    await send('background');
    expect(mockRestore).toHaveBeenCalledTimes(1);
    await view.rerender({ choice: 'max', status: 'paused' });
    await view.rerender({ choice: 'max', status: 'tracking' });
    await act(async () => {});
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it('gives back at the end (summary) and when the screen goes away', async () => {
    const view = await mount('max');
    await act(async () => {});
    await view.rerender({ choice: 'max', status: 'ended' });
    await act(async () => {});
    expect(mockRestore).toHaveBeenCalledTimes(1);

    const other = await mount('max');
    await act(async () => {});
    await other.unmount();
    expect(mockRestore).toHaveBeenCalledTimes(2);
  });

  it('survives a failing call', async () => {
    mockSet.mockRejectedValueOnce(new Error('no window'));
    const view = await mount('max');
    await act(async () => {});
    await expect(view.unmount()).resolves.not.toThrow();
  });
});

describe('iOS (the whole phone)', () => {
  beforeEach(() => setPlatform('ios'));

  it('reads the value, raises, writes the value back at the end', async () => {
    const view = await mount('max');
    await act(async () => {});
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenLastCalledWith(1);
    await view.rerender({ choice: 'max', status: 'ended' });
    await act(async () => {});
    expect(mockSet).toHaveBeenLastCalledWith(0.3);
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it('writes the value back when the choice goes back to "Automatique"', async () => {
    const view = await mount('max');
    await act(async () => {});
    await view.rerender({ choice: 'auto', status: 'tracking' });
    await act(async () => {});
    expect(mockSet).toHaveBeenLastCalledWith(0.3);
  });

  it('gives back at once on "background", not on "inactive"', async () => {
    await mount('max');
    await act(async () => {});
    mockSet.mockClear();
    await send('inactive');
    expect(mockSet).not.toHaveBeenCalled();
    await send('background');
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(0.3);
  });

  it('reads the phone again at the return: the rider may have changed it', async () => {
    const view = await mount('max');
    await act(async () => {});
    await send('background');
    await view.rerender({ choice: 'max', status: 'paused' });
    mockGet.mockResolvedValue(0.8);
    await view.rerender({ choice: 'max', status: 'tracking' });
    await act(async () => {});
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenLastCalledWith(1);
    await view.rerender({ choice: 'auto', status: 'tracking' });
    await act(async () => {});
    expect(mockSet).toHaveBeenLastCalledWith(0.8);
  });

  it('does not raise after a release that came during the reading', async () => {
    let answer: (value: number) => void = () => {};
    mockGet.mockImplementation(
      () => new Promise<number>((resolve) => (answer = resolve)),
    );
    const view = await mount('max');
    await view.rerender({ choice: 'auto', status: 'tracking' });
    await act(async () => {
      answer(0.3);
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('writes the value back when the screen goes away', async () => {
    const view = await mount('max');
    await act(async () => {});
    await view.unmount();
    expect(mockSet).toHaveBeenLastCalledWith(0.3);
  });

  it('survives a failing reading', async () => {
    mockGet.mockRejectedValueOnce(new Error('no screen'));
    const view = await mount('max');
    await act(async () => {});
    expect(mockSet).not.toHaveBeenCalled();
    await expect(view.unmount()).resolves.not.toThrow();
  });
});
