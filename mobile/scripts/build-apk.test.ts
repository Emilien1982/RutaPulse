import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import pkg from '../package.json';

const script = path.join(__dirname, 'build-apk.sh');

describe('build-apk.sh', () => {
  it('is the target of npm run build:apk', () => {
    expect(pkg.scripts['build:apk']).toBe('bash scripts/build-apk.sh');
  });

  it('stops before any build when the signing file is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-'));
    const missing = path.join(dir, 'none.properties');
    const result = spawnSync('bash', [script], {
      env: { ...process.env, RUTAPULSE_SIGNING: missing },
      encoding: 'utf8',
    });
    fs.rmSync(dir, { recursive: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Fichier de signature introuvable');
  });

  it('never installs anything and checks the debug certificate', () => {
    const text = fs.readFileSync(script, 'utf8');
    expect(text).not.toMatch(/adb |expo run:android|installRelease/);
    expect(text).toContain('CN=Android Debug');
    expect(text).toContain('-PreactNativeArchitectures=arm64-v8a');
  });
});
