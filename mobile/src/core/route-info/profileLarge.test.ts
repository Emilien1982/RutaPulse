import { elevationRange } from './profile';

describe('elevationRange on a long profile', () => {
  it('handles 200 000 altitudes', () => {
    const profile: [number, number | null][] = [];
    for (let i = 0; i < 200_000; i++) profile.push([i * 30, 100 + (i % 500)]);
    expect(elevationRange(profile)).toEqual({ minM: 100, maxM: 599 });
  });
});
