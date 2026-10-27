import { Paths } from 'expo-file-system';

import valhalla from '@modules/valhalla-route';

import {
  createRoutingEngine,
  type EnginePaths,
} from '@/core/routing/routingEngine';
import type { Zone } from '@/core/zones/catalogue';
import { filePath, versionDir } from '@/core/zones/zoneLayout';

// Plain file paths, without file://, rebuilt from the document folder at
// every opening (ADR 0013).
function pathsOf(zone: Zone): EnginePaths {
  const plain = (relative: string) =>
    `${Paths.document.uri.replace(/^file:\/\//, '').replace(/\/$/, '')}/${relative}`;
  return {
    tarPath: plain(filePath(zone, { path: 'valhalla_tiles.tar' })),
    elevationDir: plain(`${versionDir(zone)}/elevation`),
  };
}

/** The only engine of the app. */
export const routingEngine = createRoutingEngine(valhalla, pathsOf);
