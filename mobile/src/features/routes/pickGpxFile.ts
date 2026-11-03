// The choice of a file and its reading (ADR 0019, section 7). Nothing here
// reaches the network: the file is read as text, nothing more.

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { readGpx, type GpxRefusal, type GpxResult } from '@/core/gpx/readGpx';

/** 20 MB, as the Files app shows them. */
export const MAX_IMPORT_BYTES = 20_000_000;

export type PickedGpx =
  | { status: 'cancelled' }
  | { status: 'refused'; reason: GpxRefusal; sizeBytes?: number }
  | {
      status: 'read';
      fileName: string;
      gpx: Extract<GpxResult, { ok: true }>;
    };

function remove(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // The copy is in the cache: the system will empty it.
  }
}

/**
 * Opens the picker (any type of file: the system says
 * `application/octet-stream` for a .gpx), checks the size in bytes before
 * any reading, then reads the text. `onReading` is called once the file is
 * chosen. The copy in the cache is erased in every case.
 */
export async function pickGpxFile(onReading?: () => void): Promise<PickedGpx> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return { status: 'cancelled' };
  onReading?.();
  try {
    const size = asset.size ?? new File(asset.uri).size;
    if (size > MAX_IMPORT_BYTES) {
      return { status: 'refused', reason: 'tooBig', sizeBytes: size };
    }
    if (size === 0) return { status: 'refused', reason: 'empty' };
    let text: string;
    try {
      text = await new File(asset.uri).text();
    } catch {
      return { status: 'refused', reason: 'unreadable' };
    }
    const gpx = readGpx(text);
    if (!gpx.ok) {
      return {
        status: 'refused',
        reason: gpx.reason,
        sizeBytes: gpx.reason === 'tooBig' ? text.length : undefined,
      };
    }
    return { status: 'read', fileName: asset.name, gpx };
  } catch {
    return { status: 'refused', reason: 'unreadable' };
  } finally {
    remove(asset.uri);
  }
}
