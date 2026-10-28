// Which point the error sheet is about (ADR 0016, section 5). Pure logic.

import type { RouteErrorKind } from '../routing/routeResponse';
import type { Bbox } from '../zones/catalogue';
import { isInsideBbox } from '../zones/activeZone';
import type { Draft } from './draft';

export type DraftProblem = {
  kind: RouteErrorKind;
  /** The point to mark as refused. */
  pointId: number;
  /** The failed legs that end or start at this point. */
  legIndices: number[];
};

/**
 * The problem to show, or undefined. `errors[i]` is the engine error of leg i.
 * `target` is the point of the last action (added, moved, or the arrival of
 * the leg that replaced a removed point).
 *
 * A first point outside the zone has no leg yet: it is tested here, with the
 * same rectangle as the engine, so that the sheet does not wait for point 2.
 */
export function findProblem(
  draft: Draft,
  errors: (RouteErrorKind | undefined)[],
  target: number | null,
  bbox: Bbox,
): DraftProblem | undefined {
  const { points } = draft;
  const only = points[0];
  if (points.length === 1 && only && !isInsideBbox(bbox, only.lon, only.lat)) {
    return { kind: 'outOfZone', pointId: only.id, legIndices: [] };
  }
  const failed = draft.modes.flatMap((_, index) => {
    const kind = errors[index];
    const from = points[index];
    const to = points[index + 1];
    return kind && from && to ? [{ index, kind, from, to }] : [];
  });
  if (failed.length === 0) return undefined;
  const chosen =
    failed.find((f) => f.from.id === target || f.to.id === target) ??
    failed[failed.length - 1];
  if (!chosen) return undefined;
  const outside = (p: { lon: number; lat: number }) =>
    !isInsideBbox(bbox, p.lon, p.lat);
  const ends = [chosen.from, chosen.to];
  let pointId: number;
  if (chosen.kind === 'outOfZone') {
    // The engine refuses the leg because one end is outside: mark that one.
    const refused =
      ends.find((p) => p.id === target && outside(p)) ?? ends.find(outside);
    pointId = (refused ?? chosen.to).id;
  } else {
    pointId = ends.some((p) => p.id === target)
      ? (target as number)
      : chosen.to.id;
  }
  const legIndices = failed
    .filter((f) => f.from.id === pointId || f.to.id === pointId)
    .map((f) => f.index);
  return { kind: chosen.kind, pointId, legIndices };
}
