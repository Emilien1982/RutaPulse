import { fireEvent, render, screen } from '@testing-library/react-native';

import { RenameSheet } from './RenameSheet';

const sheet = (initialName = 'Ancien') =>
  render(
    <RenameSheet
      initialName={initialName}
      onSubmit={jest.fn()}
      onCancel={jest.fn()}
    />,
  );
const input = () => screen.getByTestId('rename-input');

describe('RenameSheet cut and counter', () => {
  it('accepts a space after 59 letters: the counter stays at 59 / 60', async () => {
    await sheet();
    const value = `${'a'.repeat(59)} `;
    await fireEvent.changeText(input(), value);
    expect(input().props.value).toBe(value);
    expect(screen.getByTestId('rename-count')).toHaveTextContent('59 / 60');
  });

  it('counts the normalized name: spaces in excess do not use the 60 characters', async () => {
    await sheet();
    const value = `${'a'.repeat(30)}     ${'b'.repeat(29)}`;
    await fireEvent.changeText(input(), value);
    expect(input().props.value).toBe(value);
    expect(screen.getByTestId('rename-count')).toHaveTextContent('60 / 60');
  });

  it('cuts a pasted name to 60 characters of the normalized name', async () => {
    await sheet();
    await fireEvent.changeText(input(), 'a'.repeat(80));
    expect(input().props.value).toBe('a'.repeat(60));
    expect(screen.getByTestId('rename-count')).toHaveTextContent('60 / 60');
  });
});
