import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EmptyMap } from './EmptyMap';

describe('B4: empty state of the map', () => {
  it('draws the cyclist, the bike and the ground, with named groups', async () => {
    await render(<EmptyMap onChooseZone={() => {}} />);
    expect(screen.getByText('Pas encore de carte')).toBeTruthy();
    const json = JSON.stringify(screen.toJSON());
    for (const name of [
      'vetetiste',
      'buste',
      'bras',
      'jambe',
      'velo',
      'sol',
      'collines',
    ]) {
      expect(json).toContain(`"name":"${name}"`);
    }
  });

  // Mockup 91 (design/v1/91-carte-sans-zone.html): drawing from y 47 to 472,
  // title at 484 (gap 12), text of 2 lines ending near 568, button at 600
  // (gap 31). Everything is in the flow, so that the button never leaves a
  // short screen (iPhone SE) and the drawing shrinks first.
  type Node = {
    type: string;
    props: { style?: unknown };
    children: (Node | string)[] | null;
  };
  const flat = (n: Node) =>
    StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;
  function walk(n: Node | string, fn: (n: Node) => void) {
    if (typeof n === 'string') return;
    fn(n);
    n.children?.forEach((c) => walk(c, fn));
  }
  function ancestorsOf(root: Node, text: string): Node[] {
    let found: Node[] = [];
    const visit = (n: Node | string, path: Node[]) => {
      if (typeof n === 'string') {
        if (n === text) found = path;
        return;
      }
      n.children?.forEach((c) => visit(c, [...path, n]));
    };
    visit(root, []);
    return found;
  }

  it('keeps the title and the button in the flow, with the gaps of the mockup', async () => {
    await render(<EmptyMap onChooseZone={() => {}} />);
    const root = screen.toJSON() as unknown as Node;
    const all: Node[] = [];
    walk(root, (n) => all.push(n));
    // No absolute position anywhere.
    expect(all.some((n) => flat(n)?.position === 'absolute')).toBe(false);
    expect(JSON.stringify(root)).not.toContain('"top":600');
    // Gap of 12 between the drawing and the title block.
    const title = ancestorsOf(root, 'Pas encore de carte');
    expect(title.some((n) => flat(n)?.marginTop === 12)).toBe(true);
    // Gap of 31 between the text and the button.
    const button = ancestorsOf(root, 'Choisir une zone');
    expect(button.some((n) => flat(n)?.marginTop === 31)).toBe(true);
  });

  it('lets the drawing shrink on a short screen', async () => {
    await render(<EmptyMap onChooseZone={() => {}} />);
    const root = screen.toJSON() as unknown as Node;
    const all: Node[] = [];
    walk(root, (n) => all.push(n));
    const shrinking = all.filter((n) => flat(n)?.flexShrink === 1);
    expect(shrinking.length).toBeGreaterThanOrEqual(1);
    // It holds the drawing: 425 tall in the mockup, and it has a minimum.
    const box = shrinking[0];
    expect(flat(box).height).toBe(425);
    expect(Number(flat(box).minHeight)).toBeGreaterThan(0);
    expect(JSON.stringify(box)).toContain('"name":"vetetiste"');
  });
});
