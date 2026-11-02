// MTB difficulty of a route (ADR 0018, section 2): the level of each way
// (OSM `mtb:scale`, S0 to S6) comes from a table in the zone package. A way
// that is not in the table, an edge without way id and a hand leg are
// "unknown".

import type { Block, LegInfo } from './routeInfo';
import { roundShares } from './terrain';

export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DifficultyTable = ReadonlyMap<number, Level>;
export type DifficultyPart = Level | 'unknown';
export type DifficultyShare = {
  part: DifficultyPart;
  km: number;
  percent: number;
};
export type DifficultyInfo = { shares: DifficultyShare[] };

const LEVELS: Level[] = [0, 1, 2, 3, 4, 5, 6];
const FORMAT_VERSION = 1;
const EMPTY: DifficultyTable = new Map();

/** Reads `difficulty.json`. Never throws: anything wrong gives an empty table. */
export function parseDifficultyTable(text: string | null): DifficultyTable {
  if (text === null) return EMPTY;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return EMPTY;
    const o = value as Record<string, unknown>;
    const lists = o.waysByLevel;
    if (o.formatVersion !== FORMAT_VERSION) return EMPTY;
    if (!Array.isArray(lists) || lists.length !== LEVELS.length) return EMPTY;
    const table = new Map<number, Level>();
    for (const level of LEVELS) {
      const ways: unknown = lists[level];
      if (!Array.isArray(ways)) return EMPTY;
      for (const way of ways) {
        if (typeof way !== 'number' || !Number.isSafeInteger(way) || way < 1) {
          return EMPTY;
        }
        if (table.has(way)) return EMPTY;
        table.set(way, level);
      }
    }
    return table;
  } catch {
    return EMPTY;
  }
}

/**
 * Shares of each level and of "unknown", in length, on the same base and
 * with the same rounding as the terrain. `shares` is in display order
 * (known levels from the longest, then unknown), lengths above 0 only.
 * A table of `undefined` is "not read yet".
 */
export function summarizeDifficulty(
  legs: LegInfo[],
  table: DifficultyTable | undefined,
): Block<DifficultyInfo> {
  if (legs.length === 0) return { status: 'missing' };
  const paths = legs.filter((leg) => leg.mode === 'path');
  if (paths.some((leg) => leg.terrain && !leg.terrain.ok)) {
    return { status: 'missing' };
  }
  if (!table || paths.some((leg) => !leg.terrain)) {
    return { status: 'pending' };
  }
  // Index 0 to 6: levels; index 7: unknown.
  const km = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const leg of legs) {
    if (leg.mode === 'hand') km[7] = (km[7] as number) + leg.handKm;
    else if (leg.terrain && leg.terrain.ok) {
      for (const edge of leg.terrain.edges) {
        const level =
          edge.wayId === undefined ? undefined : table.get(edge.wayId);
        const index = level === undefined ? 7 : level;
        km[index] = (km[index] as number) + edge.lengthKm;
      }
    }
  }
  if (!(km.reduce((sum, v) => sum + v, 0) > 0)) return { status: 'missing' };
  const percents = roundShares(km);
  const all: DifficultyShare[] = km.map((value, i) => ({
    part: i === 7 ? 'unknown' : (i as Level),
    km: value,
    percent: percents[i] as number,
  }));
  const known = all
    .slice(0, 7)
    .filter((share) => share.km > 0)
    .sort((a, b) => b.km - a.km); // stable: equal lengths keep the lower level first
  const unknown = all[7] as DifficultyShare;
  return {
    status: 'ready',
    shares: unknown.km > 0 ? [...known, unknown] : known,
  };
}
