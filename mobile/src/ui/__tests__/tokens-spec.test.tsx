// Tests written from design/tokens.md (the reference), not from the code.
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '../Button';
import { FloatingButton } from '../FloatingButton';
import { Stripes, STRIPES_HEIGHT } from '../Stripes';
import { BANNER_HEIGHT } from '../StripedBanner';
import {
  border,
  colors,
  fontAssets,
  fontFamily,
  radius,
  target,
  text,
} from '../theme';

// The project has no Node type definitions: describe only what is used here.
type Bytes = {
  length: number;
  subarray(a: number, b: number): { toString(enc: string): string };
  includes(s: unknown): boolean;
};
declare const __dirname: string;
const fs = jest.requireActual('fs') as {
  readFileSync(p: string): Bytes;
  readFileSync(p: string, enc: 'utf8'): string;
};
const path = jest.requireActual('path') as {
  join(...p: string[]): string;
  resolve(...p: string[]): string;
};
const root = path.resolve(__dirname, '../../..');

describe('couleurs hn.* (design/tokens.md lignes 86-98)', () => {
  it.each([
    ['hn.creme (l.86)', colors.cream, '#F4E4C1'],
    ['hn.creme-clair (l.87)', colors.creamLight, '#FBF1DA'],
    ['hn.sable (l.88)', colors.sand, '#F7DDA6'],
    ['hn.brun (l.89)', colors.brown, '#3A1F0F'],
    ['hn.brun-2 (l.90)', colors.brown2, '#5A3A28'],
    ['hn.sur-brun = hn.creme (l.91)', colors.onBrown, '#F4E4C1'],
    ['hn.moutarde (l.92)', colors.mustard, '#F0A830'],
    ['hn.moutarde-pale (l.93)', colors.mustardPale, '#F6CB7A'],
    ['hn.orange (l.94)', colors.orange, '#E2652B'],
    ['hn.rouille (l.95)', colors.rust, '#B5452A'],
    ['hn.danger (l.98)', colors.danger, '#8A1C12'],
    ['hn.succes (l.99)', colors.success, '#0F5223'],
  ])('%s', (_name, actual, expected) => {
    expect(actual.toUpperCase()).toBe(expected);
  });
});

describe('bords, rayons, cibles (tokens.md l.285-303)', () => {
  it('hn.bord 2,5 et hn.bord-fort 3', () => {
    expect(border.normal).toBe(2.5);
    expect(border.strong).toBe(3);
  });
  it('hn.rayon-bouton : 24 pour 48, 28 pour 56', () => {
    expect(radius.button48).toBe(24);
    expect(radius.button56).toBe(28);
  });
  it('cible.arret 48 et cible.bouton-principal 56', () => {
    expect(target.stop).toBe(48);
    expect(target.mainButton).toBe(56);
  });
  it('hn.ombre : 0 2 8, brun a 30 % (l.100)', () => {
    const { shadow } = jest.requireActual(
      '../theme',
    ) as typeof import('../theme');
    expect(shadow.shadowColor).toBe('#3A1F0F');
    expect(shadow.shadowOffset).toEqual({ width: 0, height: 2 });
    expect(shadow.shadowRadius).toBe(8);
    expect(shadow.shadowOpacity).toBeCloseTo(0.3);
  });
});

describe('rayures (tokens.md l.110-111, 117)', () => {
  it('trois bandes de 3, moutarde, orange, rouille, 9 en tout', async () => {
    await render(<Stripes />);
    const bands = screen.getByTestId('stripes').children as unknown as {
      props: { style: unknown };
    }[];
    expect(bands).toHaveLength(3);
    const flat = bands.map(
      (b) =>
        StyleSheet.flatten(b.props.style as object) as Record<string, unknown>,
    );
    expect(flat.map((s) => s.backgroundColor)).toEqual([
      '#F0A830',
      '#E2652B',
      '#B5452A',
    ]);
    expect(flat.map((s) => s.height)).toEqual([3, 3, 3]);
    expect(STRIPES_HEIGHT).toBe(9);
  });
  it('bandeau de 200 de haut', () => {
    expect(BANNER_HEIGHT).toBe(200);
  });
});

describe('boutons', () => {
  const heightOf = (el: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(el.props.style as object) as Record<string, number>;

  it.each(['primary', 'secondary', 'download'] as const)(
    'cible tactile >= 48 et pilule (%s)',
    async (variant) => {
      await render(<Button label="Go" variant={variant} onPress={() => {}} />);
      const style = heightOf(screen.getByRole('button'));
      expect(style.height).toBeGreaterThanOrEqual(48);
      expect(style.borderRadius).toBe(style.height / 2);
    },
  );
  it('hauteurs : principal 56, secondaire 56, telecharger 48', async () => {
    for (const [variant, h] of [
      ['primary', 56],
      ['secondary', 56],
      ['download', 48],
    ] as const) {
      await render(
        <Button label={variant} variant={variant} onPress={() => {}} />,
      );
      expect(
        heightOf(screen.getByRole('button', { name: variant })).height,
      ).toBe(h);
    }
  });
  it('role bouton et libelle accessible', async () => {
    await render(<Button label="Télécharger" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeTruthy();
  });
  it('bouton flottant : role, libelle, >= 48, bord brun 2,5', async () => {
    await render(
      <FloatingButton
        accessibilityLabel="Me localiser"
        onPress={() => {}}
        icon={() => null}
      />,
    );
    const s = heightOf(screen.getByRole('button', { name: 'Me localiser' }));
    expect(s.width).toBeGreaterThanOrEqual(48);
    expect(s.height).toBeGreaterThanOrEqual(48);
    expect(s.borderWidth).toBe(2.5);
    expect(s.borderColor).toBe('#3A1F0F');
    expect(s.backgroundColor).toBe('#FBF1DA');
  });
  it('bouton desactive signale son etat', async () => {
    await render(<Button label="X" disabled onPress={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'X' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});

describe('police Jost (tokens.md l.201-208)', () => {
  it('est declaree sous le nom utilise par les styles', () => {
    expect(fontFamily.display).toBe('Jost');
    expect(Object.keys(fontAssets)).toContain('Jost');
  });
  it('titres en Jost, capitales pour titre d ecran (26) et surtitre (13)', () => {
    expect(text.titleScreen).toMatchObject({
      fontFamily: 'Jost',
      fontSize: 26,
      textTransform: 'uppercase',
    });
    expect(text.sectionLabel).toMatchObject({
      fontFamily: 'Jost',
      textTransform: 'uppercase',
    });
    expect(text.buttonAction).toMatchObject({
      fontFamily: 'Jost',
      fontSize: 17,
    });
  });
  it('le fichier TTF existe et est une vraie police', () => {
    const buf = fs.readFileSync(
      path.join(root, 'assets/fonts/Jost_700Bold.ttf'),
    );
    expect(buf.length).toBeGreaterThan(20000);
    const magic = buf.subarray(0, 4).toString('hex');
    expect(['00010000', '74727565', '4f54544f']).toContain(magic);
    // The name table stores "Jost" in UTF-16 big endian.
    expect(buf.subarray(0, buf.length).toString('hex')).toContain(
      '004a006f00730074',
    );
  });
  it('la licence OFL est livree avec la police', () => {
    const lic = fs.readFileSync(
      path.join(root, 'assets/fonts/OFL.txt'),
      'utf8',
    );
    expect(lic).toMatch(/SIL OPEN FONT LICENSE/i);
    expect(lic).toMatch(/Jost/);
  });
  it('chiffres tabulaires sur les textes de chiffres (l.249)', () => {
    for (const k of ['body', 'secondary', 'caption'] as const) {
      expect(text[k].fontVariant).toContain('tabular-nums');
    }
  });
});
