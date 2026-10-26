// Map glyphs (letter shapes for MapLibre): shipped in the app, copied into
// `<document>/glyphs/<n>/` at launch. ADR 0013, section 2.

import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { useQuery } from '@tanstack/react-query';

/** Raise it when the glyph set changes: the old folder is then erased. */
export const GLYPHS_VERSION = 1;
const ROOT = 'glyphs';
const READY = '.ready';

// Metro needs static paths. Ranges: French letters and punctuation.
export type GlyphAsset = { path: string; module: number };

function glyphAssets(): GlyphAsset[] {
  /* eslint-disable @typescript-eslint/no-require-imports */
  return [
    [
      'NotoSans-Regular',
      '0-255',
      require('../../../assets/glyphs/NotoSans-Regular/0-255.pbf'),
    ],
    [
      'NotoSans-Regular',
      '256-511',
      require('../../../assets/glyphs/NotoSans-Regular/256-511.pbf'),
    ],
    [
      'NotoSans-Regular',
      '8192-8447',
      require('../../../assets/glyphs/NotoSans-Regular/8192-8447.pbf'),
    ],
    [
      'NotoSans-Bold',
      '0-255',
      require('../../../assets/glyphs/NotoSans-Bold/0-255.pbf'),
    ],
    [
      'NotoSans-Bold',
      '256-511',
      require('../../../assets/glyphs/NotoSans-Bold/256-511.pbf'),
    ],
    [
      'NotoSans-Bold',
      '8192-8447',
      require('../../../assets/glyphs/NotoSans-Bold/8192-8447.pbf'),
    ],
    [
      'NotoSans-Italic',
      '0-255',
      require('../../../assets/glyphs/NotoSans-Italic/0-255.pbf'),
    ],
    [
      'NotoSans-Italic',
      '256-511',
      require('../../../assets/glyphs/NotoSans-Italic/256-511.pbf'),
    ],
    [
      'NotoSans-Italic',
      '8192-8447',
      require('../../../assets/glyphs/NotoSans-Italic/8192-8447.pbf'),
    ],
  ].map(([font, range, module]) => ({
    path: `${font}/${range}.pbf`,
    module: module as number,
  }));
  /* eslint-enable @typescript-eslint/no-require-imports */
}

const versionDir = () =>
  new Directory(Paths.document, ROOT, String(GLYPHS_VERSION));

/** `file://` address of the glyph folder, without a trailing slash. */
export function glyphsDirUri(): string {
  return versionDir().uri.replace(/\/$/, '');
}

/** Copies the glyphs if they are not there yet, and erases old versions. */
export async function ensureGlyphs(
  assets: GlyphAsset[] = glyphAssets(),
): Promise<void> {
  const dir = versionDir();
  const ready = new File(dir, READY);
  if (!ready.exists) {
    for (const { path, module } of assets) {
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error(`Glyph file not found: ${path}`);
      const target = new File(dir, path);
      target.parentDirectory.create({ intermediates: true, idempotent: true });
      // Copy and write are asynchronous. `overwrite`: a copy cut short earlier
      // may have left the file there.
      await new File(asset.localUri).copy(target, { overwrite: true });
    }
    ready.create({ intermediates: true, overwrite: true });
    // Written last: it says that every copy above is complete.
    await ready.write(String(GLYPHS_VERSION));
  }
  const root = new Directory(Paths.document, ROOT);
  for (const entry of root.list()) {
    if (entry.name !== String(GLYPHS_VERSION)) entry.delete();
  }
}

/**
 * True once the glyphs have been tried: copied, or failed. On failure the map
 * is shown anyway, without labels.
 */
export function useGlyphsReady(): boolean {
  const query = useQuery({
    queryKey: ['map', 'glyphs', GLYPHS_VERSION],
    queryFn: async () => {
      await ensureGlyphs();
      return true;
    },
    networkMode: 'always',
    retry: 1,
  });
  return query.isSuccess || query.isError;
}
