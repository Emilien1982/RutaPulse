import { directionLabel, directionText, type Direction } from './directionText';

const turn = (patch: Partial<Direction> & { gesture: string }): Direction =>
  ({ kind: 'turn', atM: 100, ...patch }) as Direction;

describe('directionLabel (texts of the mock-up 30)', () => {
  it.each([
    [{ gesture: 'slight', side: 'left' }, 'Légèrement à gauche'],
    [{ gesture: 'slight', side: 'right' }, 'Légèrement à droite'],
    [{ gesture: 'turn', side: 'left' }, 'Tournez à gauche'],
    [{ gesture: 'turn', side: 'right' }, 'Tournez à droite'],
    [{ gesture: 'sharp', side: 'left' }, 'Virage serré à gauche'],
    [{ gesture: 'sharp', side: 'right' }, 'Virage serré à droite'],
    [{ gesture: 'fork', side: 'left' }, 'À la fourche, à gauche'],
    [{ gesture: 'fork', side: 'right' }, 'À la fourche, à droite'],
    [{ gesture: 'straight' }, 'Continuez tout droit'],
    [{ gesture: 'uturn', side: 'right' }, 'Faites demi-tour'],
    [{ gesture: 'roundabout', exit: 2 }, 'Au rond-point, 2e sortie'],
    [{ gesture: 'roundabout', exit: 3 }, 'Au rond-point, 3e sortie'],
    [{ gesture: 'roundabout', exit: 1 }, 'Au rond-point, 1re sortie'],
  ])('writes %j', (patch, text) => {
    expect(directionLabel(turn(patch))).toBe(text);
  });

  it('adds the kind of way after the gesture, never a street name', () => {
    expect(
      directionLabel(turn({ gesture: 'turn', side: 'left', way: 'track' })),
    ).toBe('Tournez à gauche sur la piste');
    expect(
      directionLabel(turn({ gesture: 'slight', side: 'right', way: 'trail' })),
    ).toBe('Légèrement à droite sur le sentier');
    expect(
      directionLabel(turn({ gesture: 'sharp', side: 'left', way: 'road' })),
    ).toBe('Virage serré à gauche sur la route');
    expect(directionLabel(turn({ gesture: 'straight', way: 'trail' }))).toBe(
      'Continuez tout droit sur le sentier',
    );
  });

  it('writes the arrival and the stretches without direction', () => {
    expect(directionLabel({ kind: 'arrive', atM: 5 })).toBe('Arrivée');
    expect(
      directionLabel({ kind: 'follow', fromM: 0, toM: 5, reason: 'hand' }),
    ).toBe('Suivez le tracé');
  });
});

describe('directionText', () => {
  it('gives a key, its parameters and the key of the way', () => {
    expect(directionText(turn({ gesture: 'roundabout', exit: 4 }))).toEqual({
      key: 'tracking.gesture.roundabout',
      params: { n: 4 },
    });
    expect(
      directionText(turn({ gesture: 'turn', side: 'right', way: 'road' })),
    ).toEqual({
      key: 'tracking.gesture.turnRight',
      wayKey: 'tracking.way.road',
    });
  });
});
