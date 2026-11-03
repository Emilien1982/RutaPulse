import { buildTraceRequest } from './infoRequest';
import { parseTraceResponse } from './infoResponse';

const edge = (wayId: unknown) =>
  JSON.stringify({
    edges: [{ use: 'path', density: 1, length: 0.5, way_id: wayId }],
  });
const wayIdOf = (text: string) => {
  const result = parseTraceResponse(text);
  if (!result.ok) throw new Error('failed');
  return result.edges[0]?.wayId;
};

describe('way id of the trace (ADR 0018, section 2)', () => {
  it('asks for the four attributes', () => {
    const request = JSON.parse(buildTraceRequest([[6, 48]]));
    expect(request.filters.attributes).toEqual([
      'edge.use',
      'edge.density',
      'edge.length',
      'edge.way_id',
    ]);
  });

  it('keeps a positive safe integer', () => {
    expect(wayIdOf(edge(340171810))).toBe(340171810);
  });

  it.each([[0], [-5], [1.5], ['12'], [null], [2 ** 60]])(
    'has no wayId for %p',
    (value) => {
      expect(wayIdOf(edge(value))).toBeUndefined();
    },
  );

  it('has no wayId when the field is absent', () => {
    const text = JSON.stringify({ edges: [{ use: 'path', length: 1 }] });
    const result = parseTraceResponse(text);
    expect(result.ok && 'wayId' in (result.edges[0] ?? {})).toBe(false);
  });
});
