import { ascentDescent } from './elevation';
import { joinProfiles, heightsOf, elevationRange } from './profile';
import { parseHeightResponse } from '../routing/infoResponse';
import type { ProfilePoint } from '../routing/infoResponse';

import iosAb from '../routing/fixtures/infos/ios-AB-height-resample30-range.json';
import androidAb from '../routing/fixtures/infos/android-AB-height-resample30-range.json';
import iosR4 from '../routing/fixtures/infos/ios-R4-height-resample30-range.json';
import iosHand from '../routing/fixtures/infos/ios-hand-height-resample30-range.json';
import iosNull from '../routing/fixtures/infos/ios-height-range-null.json';

const profileOf = (record: { response: unknown }): ProfilePoint[] => {
  const result = parseHeightResponse(JSON.stringify(record.response));
  if (!result.ok) throw new Error('unreadable fixture');
  return result.profile;
};
const heightsOfFixture = (record: { response: unknown }) =>
  heightsOf(profileOf(record)) as number[];

describe('ascentDescent', () => {
  it('ignores climbs under the threshold', () => {
    expect(ascentDescent([100, 102, 104, 100, 103])).toEqual({
      ascentM: 0,
      descentM: 0,
    });
  });
  it('counts a change of exactly 5 m', () => {
    expect(ascentDescent([100, 105])).toEqual({ ascentM: 5, descentM: 0 });
    expect(ascentDescent([105, 100])).toEqual({ ascentM: 0, descentM: 5 });
  });
  it('does not count 4 m', () => {
    expect(ascentDescent([100, 104]).ascentM).toBe(0);
  });
  it('keeps the reference until the threshold is met', () => {
    // 100 -> 103 -> 106: 6 m from the reference.
    expect(ascentDescent([100, 103, 106])).toEqual({
      ascentM: 6,
      descentM: 0,
    });
  });
  it('counts up and down on a profile', () => {
    expect(ascentDescent([100, 110, 120, 108, 100])).toEqual({
      ascentM: 20,
      descentM: 20,
    });
  });
  it('handles empty and single profiles', () => {
    expect(ascentDescent([])).toEqual({ ascentM: 0, descentM: 0 });
    expect(ascentDescent([100])).toEqual({ ascentM: 0, descentM: 0 });
  });
});

describe('joinProfiles', () => {
  it('shifts the distances by the length of the previous profiles', () => {
    expect(
      joinProfiles([
        [
          [0, 100],
          [30, 101],
        ],
        [
          [0, 101],
          [20, 102],
        ],
        [[0, 102]],
      ]),
    ).toEqual([
      [0, 100],
      [30, 101],
      [30, 101],
      [50, 102],
      [50, 102],
    ]);
  });
  it('counts 3 m + 3 m across a junction, but not leg by leg', () => {
    const a = [100, 103];
    const b = [103, 106];
    const joined = joinProfiles([
      a.map((h, i) => [i * 30, h] as ProfilePoint),
      b.map((h, i) => [i * 30, h] as ProfilePoint),
    ]);
    expect(ascentDescent(heightsOf(joined) as number[]).ascentM).toBe(6);
    expect(ascentDescent(a).ascentM + ascentDescent(b).ascentM).toBe(0);
  });
});

describe('heightsOf / elevationRange', () => {
  it('gives the low and high altitudes', () => {
    expect(
      elevationRange([
        [0, 240],
        [30, 231],
        [60, 250],
      ]),
    ).toEqual({ minM: 231, maxM: 250 });
  });
  it('is null when one altitude is null (all or nothing)', () => {
    const profile: ProfilePoint[] = [
      [0, 240],
      [30, null],
    ];
    expect(heightsOf(profile)).toBeNull();
    expect(elevationRange(profile)).toBeNull();
  });
  it('is null on an empty profile', () => {
    expect(elevationRange([])).toBeNull();
  });
  it('reads the real null answer as missing', () => {
    expect(elevationRange(profileOf(iosNull))).toBeNull();
  });
});

// Reference: `python3 -I scripts/ascent_reference.py` (method of comparer.py, T1).
describe('real answers against the Python reference', () => {
  it.each([
    ['ios A-B', iosAb, 10, 0, 230, 246],
    ['android A-B', androidAb, 10, 0, 230, 246],
    ['ios R4', iosR4, 671, 676, 255, 423],
    ['ios hand line', iosHand, 0, 0, 240, 245],
  ])('%s', (_name, fixture, up, down, min, max) => {
    expect(ascentDescent(heightsOfFixture(fixture))).toEqual({
      ascentM: up,
      descentM: down,
    });
    expect(elevationRange(profileOf(fixture))).toEqual({
      minM: min,
      maxM: max,
    });
  });
});
