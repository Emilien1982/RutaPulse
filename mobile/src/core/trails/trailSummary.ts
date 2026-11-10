// The texts of a circuit shown in its sheet and in the list "{n} circuits
// passent ici" (mockup 12). Pure: no React.

import { t } from '@/core/i18n/t';
import { formatDistance } from '@/core/routing/formatRoute';

import { refLabel, type Trail } from './trails';

/** The name, else "Circuit {ref}", else "Circuit sans nom". */
export function trailTitle(trail: Trail): string {
  if (trail.name) return trail.name;
  return trail.ref ? refLabel(trail.ref) : t('trails.noName');
}

/**
 * "35,0 km · boucle", "18,6 km · aller simple", or "environ 35 km" when the
 * order of the circuit is unknown (rounded to the kilometer).
 */
export function trailSummary(trail: Trail): string {
  const line = trail.line;
  if (line.kind !== 'ordered') {
    return t('trails.about', { n: Math.round(trail.lengthM / 1000) });
  }
  return t(line.loop ? 'trails.loop' : 'trails.oneWay', {
    distance: formatDistance(line.orderedM / 1000),
  });
}
