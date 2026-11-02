// The zone in service: the only zone that the engine, the map, the creation
// and the Infos screen read (ADR 0018, section 4). Pure logic, no React.

import { pickActiveZone } from './activeZone';
import type { Zone } from './catalogue';
import type { ReadyMarker } from './zoneLayout';

/** Undefined: the disk has not been read yet. Null: no ready zone. */
export type ZoneInService = Zone | null | undefined;

export type ZoneHold = {
  /** The zone in service when the hold was taken. */
  zone: ZoneInService;
  /** Gives the hold back. Calling it twice does nothing. */
  release: () => void;
};

export type ZoneService = {
  /** Receives the ready zones, after each reading of the disk. */
  update: (installed: ReadyMarker[]) => void;
  /** Freezes the zone in service until the hold is released. */
  hold: () => ZoneHold;
  current: () => ZoneInService;
  /** Listeners are called at once, in the order of subscription. */
  subscribe: (listener: () => void) => () => void;
};

function sameZone(a: ZoneInService, b: ZoneInService): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && a.version === b.version;
}

export function createZoneService(): ZoneService {
  let inService: ZoneInService;
  let latest: ReadyMarker[] | null = null;
  let holds = 0;
  const listeners: (() => void)[] = [];

  function apply() {
    if (!latest) return;
    const next = pickActiveZone(latest);
    if (sameZone(next, inService)) return;
    inService = next;
    for (const listener of [...listeners]) listener();
  }

  return {
    update(installed) {
      latest = installed;
      if (holds === 0) apply();
    },

    hold() {
      holds += 1;
      let released = false;
      return {
        zone: inService,
        release() {
          if (released) return;
          released = true;
          holds -= 1;
          if (holds === 0) apply();
        },
      };
    },

    current: () => inService,

    subscribe(listener) {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
}
