import { Stack } from 'expo-router';

import { DraftRoot } from '@/features/map/DraftRoot';

// The full screen holds a stack: the creation, then the Infos screen on top
// (ADR 0017, section 7). The session lives as long as the full screen. The
// saved route to modify, if any, comes from `draftTarget` (ADR 0019).
export default function DraftLayout() {
  return (
    <DraftRoot>
      <Stack screenOptions={{ headerShown: false }} />
    </DraftRoot>
  );
}
