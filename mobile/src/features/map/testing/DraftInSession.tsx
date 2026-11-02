// Test helper: the creation screen inside the real DraftSession, as
// app/draft/_layout.tsx renders it (ADR 0017, section 7). The session reads
// the installed zones and the glyphs; a test fakes those two modules, as it
// did before the session existed.

import { DraftScreen } from '../DraftScreen';
import { DraftSession } from '../DraftSession';

export function DraftInSession() {
  return (
    <DraftSession>
      <DraftScreen />
    </DraftSession>
  );
}
