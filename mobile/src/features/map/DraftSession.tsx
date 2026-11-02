// What the creation screen and the Infos screen share while the full screen
// is open: the active zone and the Store of the draft (ADR 0017, section 7).
// The Store lives as long as the full screen, no longer (ADR 0016).

import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { pickActiveZone } from '@/core/zones/activeZone';
import type { Zone } from '@/core/zones/catalogue';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';
import { colors } from '@/ui/theme';

import { createDraftStore } from './draftStore';
import { useGlyphsReady } from './useGlyphsReady';

export type DraftSessionValue = ReturnType<typeof createDraftStore> & {
  zone: Zone;
};

export const DraftSessionContext = createContext<DraftSessionValue | null>(
  null,
);

export function useDraftSession(): DraftSessionValue {
  const session = useContext(DraftSessionContext);
  if (!session) throw new Error('useDraftSession needs a DraftSession');
  return session;
}

// Waits for the disk like the map tab does: the zone, then the glyphs.
export function DraftSession({ children }: { children: ReactNode }) {
  const installed = useInstalledZones();
  const glyphsReady = useGlyphsReady();
  const zone = installed.data ? pickActiveZone(installed.data) : null;
  if (!zone || !glyphsReady) return <View style={styles.blank} />;
  return (
    <ZoneSession key={`${zone.id}-${zone.version}`} zone={zone}>
      {children}
    </ZoneSession>
  );
}

function ZoneSession({ zone, children }: { zone: Zone; children: ReactNode }) {
  const [draft] = useState(createDraftStore);
  const [session] = useState(() => ({ ...draft, zone }));
  return (
    <DraftSessionContext.Provider value={session}>
      {children}
    </DraftSessionContext.Provider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.cream },
});
