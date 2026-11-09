// What the creation screen and the Infos screen share while the full screen
// is open: the active zone and the Store of the draft (ADR 0017, section 7).
// The Store lives as long as the full screen, no longer (ADR 0016). With a
// `routeId`, it starts from a saved route (ADR 0019, section 4); with a
// `trail`, from a waymarked circuit cut into legs (ADR 0020, section 10).

import { useRouter } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n/t';
import { reopenDraft, type KeptLegs } from '@/core/routes/reopen';
import { trailRouteName } from '@/core/routes/routeName';
import type { CreatedRoute } from '@/core/routes/savedRoute';
import { hasLegOutside, traceToDraft } from '@/core/routes/traceDraft';
import { trailTitle } from '@/core/trails/trailSummary';
import type { Trail, TrailLine } from '@/core/trails/trails';
import type { Zone } from '@/core/zones/catalogue';
import { useSavedRoute } from '@/shared-data/routes/useRoutes';
import { useZoneHold } from '@/shared-data/zones/zoneInService';
import { colors } from '@/ui/theme';

import { createDraftStore } from './draftStore';
import type { TrailTarget } from './draftTarget';
import { useGlyphsReady } from './useGlyphsReady';
import { useTrails } from './useTrails';

export type DraftSessionValue = ReturnType<typeof createDraftStore> & {
  zone: Zone;
  /** Saved shapes of a reopened route. */
  kept?: KeptLegs;
  /** Set when the creation starts from a circuit (not yet saved). */
  trail?: {
    /** Default name of the route, before "(2)". */
    name: string;
    /** Name of the circuit, for the announcement. */
    title: string;
    /** A part of the trace leaves the zone. */
    outside: boolean;
  };
};

export const DraftSessionContext = createContext<DraftSessionValue | null>(
  null,
);

export function useDraftSession(): DraftSessionValue {
  const session = useContext(DraftSessionContext);
  if (!session) throw new Error('useDraftSession needs a DraftSession');
  return session;
}

// Holds the zone in service for as long as it is open, so that a new version
// does not replace it under the draft (ADR 0018, section 4). Waits for the
// hold, then for the glyphs. `routeId`: a route to modify.
export function DraftSession({
  children,
  routeId,
  trail,
}: {
  children: ReactNode;
  routeId?: number;
  trail?: TrailTarget;
}) {
  const zone = useZoneHold();
  const glyphsReady = useGlyphsReady();
  if (!zone || !glyphsReady) return <View style={styles.blank} />;
  if (trail) {
    return (
      <TrailSession
        key={`trail-${trail.osmId}-${zone.id}-${zone.version}`}
        zone={zone}
        target={trail}
      >
        {children}
      </TrailSession>
    );
  }
  if (routeId !== undefined) {
    return (
      <ReopenedSession
        key={`${routeId}-${zone.id}-${zone.version}`}
        zone={zone}
        routeId={routeId}
      >
        {children}
      </ReopenedSession>
    );
  }
  return (
    <ZoneSession key={`${zone.id}-${zone.version}`} zone={zone}>
      {children}
    </ZoneSession>
  );
}

function ZoneSession({ zone, children }: { zone: Zone; children: ReactNode }) {
  const [draft] = useState(() => createDraftStore());
  const [session] = useState(() => ({ ...draft, zone }));
  return (
    <DraftSessionContext.Provider value={session}>
      {children}
    </DraftSessionContext.Provider>
  );
}

// Reads the route, then checks that the zone held is its zone. Otherwise it
// closes with a message.
function ReopenedSession({
  zone,
  routeId,
  children,
}: {
  zone: Zone;
  routeId: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const query = useSavedRoute(routeId);
  const route = query.data;
  const usable =
    route && route.readable && route.origin !== 'gpx' ? route : null;
  const refused =
    (route !== undefined || query.isError) &&
    (!usable || usable.zone.id !== zone.id);
  useEffect(() => {
    if (!refused) return;
    Alert.alert(
      t('route.zoneAbsentTitle'),
      t(usable || !route ? 'route.zoneAbsentText' : 'route.unreadableText'),
    );
    router.back();
  }, [refused, usable, route, router]);
  if (!usable || refused) return <View style={styles.blank} />;
  return (
    <OpenedSession zone={zone} route={usable}>
      {children}
    </OpenedSession>
  );
}

// Finds the circuit in the zone held, then cuts it once. A circuit that is
// gone or has no ordered line (the zone changed meanwhile) closes the
// creation with a message.
function TrailSession({
  zone,
  target,
  children,
}: {
  zone: Zone;
  target: TrailTarget;
  children: ReactNode;
}) {
  const router = useRouter();
  const trails = useTrails(zone);
  const trail = trails?.find((candidate) => candidate.osmId === target.osmId);
  const line = trail?.line.kind === 'ordered' ? trail.line : null;
  const gone = trails !== undefined && !line;
  useEffect(() => {
    if (!gone) return;
    Alert.alert(t('trails.goneTitle'), t('trails.goneText'));
    router.back();
  }, [gone, router]);
  if (!trail || !line) return <View style={styles.blank} />;
  return (
    <CutSession
      zone={zone}
      trail={trail}
      line={line}
      position={target.position}
    >
      {children}
    </CutSession>
  );
}

function CutSession({
  zone,
  trail,
  line,
  position,
  children,
}: {
  zone: Zone;
  trail: Trail;
  line: Extract<TrailLine, { kind: 'ordered' }>;
  position: TrailTarget['position'];
  children: ReactNode;
}) {
  const [session] = useState(() => {
    const { state, kept } = traceToDraft(line.ordered, {
      loop: line.loop,
      position: position && [position.lon, position.lat],
      zoneVersion: zone.version,
      bbox: zone.bbox,
    });
    // The draft saved is the starting one: closing without a change asks
    // nothing, and "Enregistrer" is open at once.
    const draft = createDraftStore(state, {
      routeId: null,
      savedDraft: state.draft,
    });
    const now = new Date();
    return {
      ...draft,
      zone,
      kept,
      trail: {
        name: trailRouteName(trail, now),
        title: trailTitle(trail),
        outside: hasLegOutside(kept, zone.bbox),
      },
    };
  });
  return (
    <DraftSessionContext.Provider value={session}>
      {children}
    </DraftSessionContext.Provider>
  );
}

function OpenedSession({
  zone,
  route,
  children,
}: {
  zone: Zone;
  route: CreatedRoute;
  children: ReactNode;
}) {
  const [session] = useState(() => {
    const { state, kept } = reopenDraft(route);
    const draft = createDraftStore(state, {
      routeId: route.id,
      savedDraft: route.draft,
    });
    return { ...draft, zone, kept };
  });
  return (
    <DraftSessionContext.Provider value={session}>
      {children}
    </DraftSessionContext.Provider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.cream },
});
