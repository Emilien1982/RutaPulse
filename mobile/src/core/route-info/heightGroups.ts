// Groups of legs asked to the engine for altitudes in one request
// (ADR 0020, section 6, parade b). Pure logic.

/**
 * `legs[i].trace` is true for a leg whose shape is a kept piece of a trace,
 * never recomputed. A run of such legs is one group; any other leg is a
 * group of its own. Returns the leg indices of each group, in order.
 */
export function heightGroups(legs: readonly { trace?: boolean }[]): number[][] {
  const groups: number[][] = [];
  let run = false;
  legs.forEach((leg, i) => {
    const isTrace = leg.trace === true;
    if (isTrace && run) groups[groups.length - 1].push(i);
    else groups.push([i]);
    run = isTrace;
  });
  return groups;
}

/**
 * The shape of a group: its leg shapes joined, the junction point once.
 */
export function joinShapes(
  shapes: readonly (readonly [number, number][])[],
): [number, number][] {
  const out: [number, number][] = [];
  for (const shape of shapes) {
    shape.forEach((p, j) => {
      const last = out[out.length - 1];
      if (j === 0 && last && last[0] === p[0] && last[1] === p[1]) return;
      out.push(p);
    });
  }
  return out;
}

/**
 * Query key of a group of trace legs: the zone, the waypoints of the group
 * in order, and `trace:N` (N = version of the zone that held the trace).
 * Other legs keep the key of `useLegInfos` (mode and shape version).
 */
export function heightGroupKey(
  zone: { id: string; version: number },
  points: readonly { lon: number; lat: number }[],
  traceVersion: number,
): (string | number)[] {
  return [
    'routing',
    'height',
    zone.id,
    zone.version,
    ...points.flatMap((p) => [p.lon, p.lat]),
    `trace:${traceVersion}`,
  ];
}
