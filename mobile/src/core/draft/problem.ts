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
  // A point kept by "Relier" comes first for "far from a path": a failed leg
  // that touches it is about it, not about the point that was added next.
  // Not for "outside the zone": the rectangle tells which end is outside.
  const linked = new Set(draft.linked ?? []);
  const viaLinked = failed.find(
    (f) =>
      f.kind === 'farFromPath' &&
      (linked.has(f.from.id) || linked.has(f.to.id)),
  );
  if (viaLinked) {
    const kept = [viaLinked.from, viaLinked.to].filter((p) => linked.has(p.id));
    const keptPoint = kept.find((p) => p.id === target) ?? kept[0];
    if (keptPoint) {
      return {
        kind: viaLinked.kind,
        pointId: keptPoint.id,
        legIndices: failed
          .filter((f) => f.from.id === keptPoint.id || f.to.id === keptPoint.id)
          .map((f) => f.index),
      };
    }
  }
  const chosen =
    failed.find((f) => f.from.id === target || f.to.id === target) ??
    failed[failed.length - 1];
  if (!chosen) return undefined;
  const outside = (p: { lon: number; lat: number }) =>
    !isInsideBbox(bbox, p.lon, p.lat);
  const ends = [chosen.from, chosen.to];
  // Two neighbouring failed legs share a point: that point is the problem,
  // even when the last action was on the other end of one of them (two quick
  // touches near a point far from a path).
  // Only for errors about a point: "no route" is about a pair of points.
  const aboutPoint =
    chosen.kind === 'farFromPath' || chosen.kind === 'outOfZone';
  const shared = failed
    .filter((f) => aboutPoint && f !== chosen && f.kind === chosen.kind)
    .flatMap((f) => ends.filter((p) => p.id === f.from.id || p.id === f.to.id))
    // Outside the zone, the shared point must really be outside.
    .filter((p) => chosen.kind !== 'outOfZone' || outside(p));
  const common = shared.find((p) => p.id === target) ?? shared[0];
  let pointId: number;
  if (common) {
    pointId = common.id;
  } else if (chosen.kind === 'outOfZone') {
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
