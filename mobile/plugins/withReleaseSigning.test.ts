import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { patchBuildGradle } = require('./withReleaseSigning');

const template = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled true
        }
    }
}
`;

describe('withReleaseSigning', () => {
  const patched: string = patchBuildGradle(template);

  it('adds a release signing config that reads the properties file', () => {
    expect(patched).toContain("System.getenv('RUTAPULSE_SIGNING')");
    expect(patched).toContain("props['storePassword']");
  });

  it('reads the file only when it exists (debug and CI keep working)', () => {
    expect(patched).toMatch(
      /signingPath != null && file\(signingPath\)\.exists\(\)/,
    );
  });

  it('points the release on the release config, debug stays on the debug key', () => {
    const release = patched.slice(
      patched.indexOf('        release {\n            //'),
    );
    expect(release).toContain('signingConfig signingConfigs.release');
    expect(release).not.toContain('signingConfig signingConfigs.debug');
    expect(patched).toContain(
      'debug {\n            signingConfig signingConfigs.debug',
    );
  });

  it('stops a release build when the properties file is missing (lock 1)', () => {
    expect(patched).toContain("it.name == 'preReleaseBuild'");
    expect(patched).toContain('RUTAPULSE_SIGNING manquant');
  });

  it('is idempotent', () => {
    expect(patchBuildGradle(patched)).toBe(patched);
  });

  it('does not treat an unrelated signingConfigs.release as already patched', () => {
    const other = template.replace(
      'signingConfig signingConfigs.debug\n            minifyEnabled',
      'signingConfig signingConfigs.release\n            minifyEnabled',
    );
    expect(() => patchBuildGradle(other)).toThrow(/has changed/);
  });

  it('fails when the line to replace is missing (lock 2)', () => {
    const changed = template.replace(
      'release {\n            // Caution',
      'release {\n            // Other',
    );
    expect(() => patchBuildGradle(changed)).toThrow(/release signing line/);
    expect(() => patchBuildGradle('android {}')).toThrow(/has changed/);
  });

  it('is declared in app.json', () => {
    const app = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'),
    );
    expect(app.expo.plugins).toContain('./plugins/withReleaseSigning');
  });
});
