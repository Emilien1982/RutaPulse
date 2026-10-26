import { File, Paths } from 'expo-file-system';

import { filePath } from '@/core/zones/zoneLayout';

/** `file://` address of a file of an installed zone, for the map style. */
export function zoneFileUri(
  zone: { id: string; version: number },
  path: string,
): string {
  const relative = filePath(zone, { path });
  return new File(Paths.document, relative).uri;
}
