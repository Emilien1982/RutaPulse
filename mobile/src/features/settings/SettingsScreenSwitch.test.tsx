import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsScreen } from './SettingsScreen';

const mockMutate = jest.fn();
let mockWifiOnly: boolean | undefined = true;
jest.mock('@/shared-data/settings/useSettings', () => ({
  useSettings: () => ({
    data: mockWifiOnly === undefined ? undefined : { wifiOnly: mockWifiOnly },
  }),
  useSetWifiOnly: () => ({ mutate: mockMutate }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockWifiOnly = true;
});

describe('SettingsScreen, Wi-Fi only switch', () => {
  it('shows the switch, on by default, with its explanation', async () => {
    mockWifiOnly = undefined;
    await render(<SettingsScreen />);
    const toggle = screen.getByRole('switch', {
      name: 'Télécharger en Wi-Fi seulement',
    });
    expect(toggle.props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByText('Téléchargements')).toBeTruthy();
    expect(
      screen.getByText(
        'Sans Wi-Fi, les zones attendent. Une zone pèse environ 100 Mo.',
      ),
    ).toBeTruthy();
  });

  it('shows the saved value', async () => {
    mockWifiOnly = false;
    await render(<SettingsScreen />);
    expect(screen.getByRole('switch').props.accessibilityState).toEqual({
      checked: false,
    });
  });

  it('writes the opposite value when pressed', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('switch'));
    expect(mockMutate).toHaveBeenCalledWith(false);
  });
});
