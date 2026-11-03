import { render, screen } from '@testing-library/react-native';

import { DashedRule } from './DashedRule';

type Node = {
  type: string;
  props: Record<string, any>;
  children: (Node | string)[] | null;
};

function collect(node: Node | string | null, out: Node[] = []): Node[] {
  if (!node || typeof node === 'string') return out;
  out.push(node);
  node.children?.forEach((child) => collect(child, out));
  return out;
}

describe('DashedRule', () => {
  it('draws a 2-wide line with dashes 6 / 4', async () => {
    await render(<DashedRule />);
    const nodes = collect(screen.toJSON() as unknown as Node);
    const line = nodes.find((n) => n.props.strokeDasharray !== undefined);
    expect(line).toBeDefined();
    expect(line!.props.strokeDasharray).toEqual(['6', '4']);
    expect(Number(line!.props.strokeWidth)).toBe(2);
  });

  it('is hidden from the screen reader', async () => {
    await render(<DashedRule />);
    const root = screen.toJSON() as unknown as Node;
    expect(root.props.accessible).toBe(false);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
