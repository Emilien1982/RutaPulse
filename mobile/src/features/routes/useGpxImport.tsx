// The import of a GPX file from the Itinéraires tab (ADR 0019, sections 6
// and 7; mockup 40, states 6a to 6d).

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { t } from '@/core/i18n/t';
import type { TextKey } from '@/core/i18n/fr';
import { buildImportedRoute } from '@/core/routes/importedRoute';
import type { Catalogue, Zone } from '@/core/zones/catalogue';
import { zonesCovering } from '@/core/zones/zonesCovering';
import { megabytes } from '@/core/zones/zoneRow';
import { getRoute } from '@/core/routes/routeRepo';
import { getRoutesDb } from '@/shared-data/routes/routesDb';
import { useRouteActions } from '@/shared-data/routes/useRoutes';
import { catalogueKey, fetchCatalogue } from '@/shared-data/zones/useCatalogue';
import { useInstalledZones } from '@/shared-data/zones/useInstalledZones';
import { useZoneInService } from '@/shared-data/zones/zoneInService';

import { OutsideSheet, type Offer } from './OutsideSheet';
import { pickGpxFile, type PickedGpx } from './pickGpxFile';

/** Slower than this, the button says "Lecture du fichier…". */
const BUSY_AFTER_MS = 500;
/** No answer from the catalogue after this: the sheet says "sans réseau". */
const CATALOGUE_TIMEOUT_MS = 5000;

const REFUSALS = {
  empty: 'routes.importEmpty',
  unreadable: 'routes.importUnreadable',
  noTrack: 'routes.importNoTrack',
} as const satisfies Record<string, TextKey>;

function refusalText(
  refused: Extract<PickedGpx, { status: 'refused' }>,
): string {
  if (refused.reason === 'tooBig') {
    // At least 21: "20 Mo" would not explain a refusal.
    const n = Math.max(21, megabytes(refused.sizeBytes ?? 0));
    return t('routes.importTooBig', { size: t('zones.megabytes', { n }) });
  }
  return t(REFUSALS[refused.reason]);
}

// The catalogue in memory, else one try to read it. Never rejects.
async function findOffer(
  client: QueryClient,
  start: [number, number],
  installedIds: string[],
): Promise<Offer> {
  let catalogue = client.getQueryData<Catalogue>(catalogueKey);
  if (!catalogue) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      catalogue = await Promise.race([
        client.fetchQuery({
          queryKey: catalogueKey,
          queryFn: fetchCatalogue,
          retry: false,
          networkMode: 'always',
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('timeout')),
            CATALOGUE_TIMEOUT_MS,
          );
        }),
      ]);
    } catch {
      return { kind: 'offline' };
    } finally {
      clearTimeout(timer);
    }
  }
  const zone = zonesCovering(catalogue.zones, start[0], start[1]).find(
    (z) => !installedIds.includes(z.id),
  );
  return zone ? { kind: 'found', zone } : { kind: 'none' };
}

type Pending = { routeId: number; offer: Offer };

/**
 * `onDownloadZone` starts the download of a zone (the downloader belongs to
 * the Zones tab: the route file gives it).
 */
export function useGpxImport(onDownloadZone?: (zone: Zone) => void): {
  start: () => void;
  busy: boolean;
  sheet: ReactNode;
} {
  const router = useRouter();
  const client = useQueryClient();
  const actions = useRouteActions();
  const inService = useZoneInService();
  const installed = useInstalledZones().data;
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const running = useRef(false);

  async function run() {
    // The delay counts from the choice of the file, not from the touch.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const picked = await pickGpxFile(() => {
        timer = setTimeout(() => setBusy(true), BUSY_AFTER_MS);
      });
      if (picked.status === 'cancelled') return;
      if (picked.status === 'refused') {
        Alert.alert(t('routes.importFailedTitle'), refusalText(picked), [
          { text: t('routes.importOk') },
        ]);
        return;
      }
      const built = buildImportedRoute(
        picked.gpx,
        picked.fileName,
        inService ?? null,
        Date.now(),
      );
      const routeId = await actions.create({ ...built, now: built.createdAt });
      const row = await getRoute(await getRoutesDb(), routeId);
      if (row) {
        AccessibilityInfo.announceForAccessibility(
          t('routes.importedAnnounce', { name: row.name }),
        );
      }
      if (built.zone) {
        router.push(`/route/${routeId}`);
        return;
      }
      const offer = await findOffer(
        client,
        picked.gpx.track[0],
        installed?.map((marker) => marker.zone.id) ?? [],
      );
      setPending({ routeId, offer });
    } catch {
      Alert.alert(t('routes.actionFailedTitle'), t('routes.actionFailedText'));
    } finally {
      clearTimeout(timer);
      setBusy(false);
      running.current = false;
    }
  }

  function start() {
    if (running.current) return;
    running.current = true;
    void run();
  }

  // "Plus tard" and "Fermer": the Infos screen of the GPX (6d).
  function showInfos(routeId: number) {
    setPending(null);
    router.push(`/route/${routeId}`);
  }

  const sheet = pending && (
    <OutsideSheet
      offer={pending.offer}
      onClose={() => showInfos(pending.routeId)}
      onSeeZones={() => {
        setPending(null);
        router.navigate('/zones');
      }}
      onDownload={(zone) => {
        setPending(null);
        onDownloadZone?.(zone);
        router.navigate('/zones');
      }}
    />
  );
  return { start, busy, sheet };
}
