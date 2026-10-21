import { fr } from './fr';
import { t } from './t';

describe('t', () => {
  it('returns the French text of fr.ts', () => {
    expect(t('tabs.routes')).toBe('Itinéraires');
    expect(t('settings.title')).toBe(fr['settings.title']);
  });
});
