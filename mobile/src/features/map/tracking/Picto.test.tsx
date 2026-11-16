import { render, screen } from '@testing-library/react-native';

import { Picto } from './Picto';

type Props = {
  cx: number | string;
  r: number | string;
  fill: unknown;
  stroke: unknown;
};

async function circlesOf(kind: 'off' | 'gps'): Promise<Props[]> {
  await render(<Picto kind={kind} />);
  const found: Props[] = [];
  const walk = (node: unknown) => {
    const n = node as { type?: string; props?: Props; children?: unknown[] };
    if (!n || typeof n !== 'object') return;
    if (n.type === 'RNSVGCircle' && n.props) found.push(n.props);
    n.children?.forEach(walk);
  };
  walk(screen.toJSON());
  return found;
}

describe('Picto, the gap (p-ecart)', () => {
  it('draws the blue disc with no stroke and three dots of radius 3.5', async () => {
    const all = await circlesOf('off');
    const dots = all.filter((c) => Number(c.r) === 3.5);
    expect(dots.map((d) => Number(d.cx))).toEqual([40, 52, 64]);
    dots.forEach((d) => expect(d.stroke).toBeNull());
    const filled = all.filter((c) => Number(c.r) === 15 && c.fill);
    expect(filled).toHaveLength(1);
    expect(filled[0]?.stroke).toBeNull();
  });
});

describe('Picto, waiting for the GPS (p-gps)', () => {
  it('draws a ring of 24 and a centre disc of 8 with no stroke', async () => {
    const all = await circlesOf('gps');
    expect(all.map((c) => Number(c.r))).toEqual([24, 8]);
    expect(all[1]?.stroke).toBeNull();
    expect(all[1]?.fill).toBeTruthy();
  });
});
