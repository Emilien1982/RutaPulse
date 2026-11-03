// Writes the GPX file of a saved route in the cache and opens the share
// sheet (ADR 0019, section 8). The file is the only one of its folder: the
// system may empty the cache, and a new export replaces the old file.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { t } from '@/core/i18n/t';
import { buildRouteGpx, exportTrackOf } from '@/core/routes/exportGpx';
import { routeZoneStatus } from '@/core/routes/routeZone';
import type { CreatedRoute, GpxRoute } from '@/core/routes/savedRoute';
import { getRoutesDb } from './routesDb';
import { getRoute } from '@/core/routes/routeRepo';
import { computePointHeights } from '@/shared-data/routing/computeInfos';
import type { Zone } from '@/core/zones/catalogue';

/** Writes the file and opens the share sheet. Throws when it cannot write. */
export async function shareGpxFile(
  fileName: string,
  text: string,
  title: string,
): Promise<void> {
  const folder = new Directory(Paths.cache, 'export');
  if (folder.exists) folder.delete();
  folder.create({ intermediates: true });
  const file = new File(folder, fileName);
  file.create({ overwrite: true });
  // `file.size` is 0 right after `write`: it is not read (T1 test).
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/gpx+xml',
    UTI: 'com.topografix.gpx',
    dialogTitle: title,
  });
}

/**
 * `usable`: the zone of a created route can give its altitudes. Without
 * them, or when the engine fails, the file has no `<ele>`.
 */
export async function exportRoute(
  route: CreatedRoute | GpxRoute,
  usable: boolean,
): Promise<void> {
  let heights: (number | null)[] | null = null;
  if (route.origin === 'created' && usable) {
    const track = exportTrackOf(route);
    const result = await computePointHeights(track);
    if (result.ok && result.heights.length === track.length) {
      heights = result.heights;
    }
  }
  const { fileName, text } = buildRouteGpx(route, heights);
  await shareGpxFile(fileName, text, route.name);
}

/**
 * `exportById(id)` never throws: a failure shows "Export impossible". The
 * screen gives the zone in service and the ready zones it already reads.
 */
export function useExportRoute(
  inService: Zone | null | undefined,
  installed: readonly Zone[] | undefined,
): (id: number) => Promise<void> {
  return useCallback(
    async (id: number) => {
      try {
        const route = await getRoute(await getRoutesDb(), id);
        if (!route || !route.readable) throw new Error('No readable route');
        const usable =
          routeZoneStatus(route, inService ?? null, installed ?? []) ===
          'usable';
        await exportRoute(route, usable);
      } catch {
        Alert.alert(
          t('routes.exportFailedTitle'),
          t('routes.exportFailedText'),
        );
      }
    },
    [inService, installed],
  );
}
