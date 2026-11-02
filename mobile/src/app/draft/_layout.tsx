import { Stack } from 'expo-router';

import { DraftSession } from '@/features/map/DraftSession';

// The full screen holds a stack: the creation, then the Infos screen on top
// (ADR 0017, section 7). The session lives as long as the full screen.
export default function DraftLayout() {
  return (
    <DraftSession>
      <Stack screenOptions={{ headerShown: false }} />
    </DraftSession>
  );
}
