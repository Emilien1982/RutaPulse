import { render, screen } from '@testing-library/react-native';

import { DashedStroke } from './DashedStroke';

describe('DashedStroke', () => {
  it('renders without error', async () => {
    await render(<DashedStroke color="#B5452A" />);
    expect(screen.toJSON()).not.toBeNull();
  });
});
