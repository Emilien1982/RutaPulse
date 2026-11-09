import { announcement } from './routeName';

describe('announcement', () => {
  it('keeps one full stop at the end', () => {
    expect(announcement('Itinéraire enregistré : Tour.')).toBe(
      'Itinéraire enregistré : Tour.',
    );
    expect(announcement('GPX importé : Itinéraire du 4 nov..')).toBe(
      'GPX importé : Itinéraire du 4 nov.',
    );
  });
});
