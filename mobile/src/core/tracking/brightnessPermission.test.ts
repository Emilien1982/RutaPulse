// ADR 0021, section 8.4: the app never changes the setting of the phone, so
// it must not ask for WRITE_SETTINGS (the plugin of expo-brightness adds it).
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Android permission WRITE_SETTINGS', () => {
  it('is blocked in app.json', () => {
    const config = JSON.parse(
      readFileSync(join(__dirname, '../../../app.json'), 'utf8'),
    ) as { expo: { android: { blockedPermissions?: string[] } } };
    expect(config.expo.android.blockedPermissions).toContain(
      'android.permission.WRITE_SETTINGS',
    );
  });
});
