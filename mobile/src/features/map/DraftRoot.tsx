// Root of the full-screen creation (`app/draft/_layout.tsx`): the session,
// started from the saved route that "Modifier" asked for, or from the circuit
// that "En faire un itinéraire" asked for, if any.

import { useEffect, useState, type ReactNode } from 'react';

import { DraftSession } from './DraftSession';
import { peekDraftTarget, setDraftTarget } from './draftTarget';

export function DraftRoot({ children }: { children: ReactNode }) {
  const [target] = useState(peekDraftTarget);
  // Read once, then cleared at once: an older creation closing later cannot
  // clear the target of a newer one.
  useEffect(() => setDraftTarget(null), []);
  return (
    <DraftSession
      routeId={target?.kind === 'route' ? target.id : undefined}
      gpxId={target?.kind === 'gpx' ? target.id : undefined}
      trail={target?.kind === 'trail' ? target : undefined}
    >
      {children}
    </DraftSession>
  );
}
