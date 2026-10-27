import { text } from './typography';

describe('text styles', () => {
  const systemFontStyles = Object.entries(text).filter(
    ([, style]) => !('fontFamily' in style),
  );

  it('has styles in the system font', () => {
    expect(systemFontStyles.length).toBeGreaterThan(0);
  });

  it.each(systemFontStyles)(
    '%s uses tabular numbers (tokens.md: digits are always tabular)',
    (_name, style) => {
      expect((style as { fontVariant?: string[] }).fontVariant).toContain(
        'tabular-nums',
      );
    },
  );
});
