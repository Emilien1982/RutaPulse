// Checks that the app declares French as its only language (phase 10a, C4).
// The values end up in Info.plist and in the Android resources at prebuild.
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import appJson from './app.json';

const { expo } = appJson;

describe('app.json language configuration', () => {
  it('declares French as the iOS development region', () => {
    expect(expo.ios.infoPlist.CFBundleDevelopmentRegion).toBe('fr');
  });

  it('lists French as the only iOS localization', () => {
    expect(expo.ios.infoPlist.CFBundleLocalizations).toEqual(['fr']);
  });

  it('has no locales key (its iOS keys break the Android release lint)', () => {
    expect(Object.keys(expo)).not.toContain('locales');
  });

  it('gives the location prompt in French', () => {
    const plugin = expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-location',
    ) as [string, { locationWhenInUsePermission: string }];
    expect(plugin[1].locationWhenInUsePermission).toMatch(/votre position/);
  });
});

describe('icons and splash screen (phase 10a, C2 and C3)', () => {
  const cream = '#F4E4C1';
  const imagesDir = path.join(__dirname, 'assets', 'images');
  // Images that belong to the app. Anything else in the folder is a leftover.
  const ownImages = [
    'android-icon-background.png',
    'android-icon-foreground.png',
    'android-icon-monochrome.png',
    'fleche-cap.png',
    'fleche-cap@2x.png',
    'fleche-cap@3x.png',
    'icon.png',
    'splash-icon.png',
  ];

  it('has only the images of the app and no Expo icon folder', () => {
    expect(fs.readdirSync(imagesDir).sort()).toEqual(ownImages);
    expect(fs.existsSync(path.join(__dirname, 'assets', 'expo.icon'))).toBe(
      false,
    );
    expect(Object.keys(expo.ios)).not.toContain('icon');
  });

  // The Expo images have the same names: check what is inside the files.
  function readPng(name: string) {
    return PNG.sync.read(fs.readFileSync(path.join(imagesDir, name)));
  }
  function pixel(png: PNG, x: number, y: number) {
    const i = (png.width * y + x) * 4;
    return [...png.data.subarray(i, i + 4)];
  }

  it('has the iOS icon opaque, 1024 px, cream in the corner', () => {
    const icon = readPng('icon.png');
    expect([icon.width, icon.height]).toEqual([1024, 1024]);
    expect(icon.alpha).toBe(false);
    expect(pixel(icon, 0, 0)).toEqual([0xf4, 0xe4, 0xc1, 255]);
  });

  it('has the Android background cream and the splash round', () => {
    expect(pixel(readPng('android-icon-background.png'), 0, 0)).toEqual([
      0xf4, 0xe4, 0xc1, 255,
    ]);
    // Corners of the splash and foreground are transparent, and the centre
    // of the splash is drawn.
    expect(pixel(readPng('splash-icon.png'), 0, 0)[3]).toBe(0);
    expect(pixel(readPng('splash-icon.png'), 512, 512)[3]).toBe(255);
    expect(pixel(readPng('android-icon-foreground.png'), 0, 0)[3]).toBe(0);
  });

  it('uses the cream colour for the splash screen', () => {
    const plugin = expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    ) as [string, { backgroundColor: string; imageWidth: number }];
    expect(plugin[1].backgroundColor).toBe(cream);
    expect(plugin[1].imageWidth).toBe(176);
  });

  it('uses the cream colour behind the Android adaptive icon', () => {
    expect(expo.android.adaptiveIcon.backgroundColor).toBe(cream);
  });

  it('removes the English location and motion prompts', () => {
    const plugin = expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-location',
    ) as [string, Record<string, unknown>];
    for (const key of [
      'locationAlwaysAndWhenInUsePermission',
      'locationAlwaysPermission',
      'motionUsagePermission',
      'locationFullAccuracyPermission',
    ]) {
      expect(plugin[1][key]).toBe(false);
    }
  });
});
