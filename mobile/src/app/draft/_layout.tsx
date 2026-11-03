import { Stack, useLocalSearchParams } from 'expo-router';

import { DraftSession } from '@/features/map/DraftSession';

// The full screen holds a stack: the creation, then the Infos screen on top
// (ADR 0017, section 7). The session lives as long as the full screen.
// `routeId`: the creation of a saved route, from "Modifier" (ADR 0019).
export default function DraftLayout() {
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const id = routeId ? Number(routeId) : undefined;
  return (
    <DraftSession routeId={Number.isInteger(id) ? id : undefined}>
      <Stack screenOptions={{ headerShown: false }} />
    </DraftSession>
  );
}
