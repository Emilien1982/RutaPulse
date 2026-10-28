import { handLengthKm, summarizeInfo, type LegInfo } from './routeInfo';
import { infoShape } from './legShape';
import { listLegs } from '../draft/legs';
import { distanceMeters } from '../routing/routeLink';
import type { Draft } from '../draft/draft';

const bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };
const ok = (heights: (number | null)[]) => ({
  ok: true as const,
  profile: heights.map((h, i) => [i * 30, h] as [number, number | null]),
});
const trace = (edges: [string, number, number][]) => ({
  ok: true as const,
  edges: edges.map(([use, density, lengthKm]) => ({ use, density, lengthKm })),
});
const failed = { ok: false as const, error: 'failed' as const };
const pathLeg = (
  height: LegInfo['height'],
  terrain: LegInfo['terrain'],
): LegInfo => ({ mode: 'path', handKm: 0, height, terrain });
const handInfo = (height: LegInfo['height'], handKm: number): LegInfo => ({
  mode: 'hand',
  handKm,
  height,
  terrain: undefined,
});

describe('summarizeInfo', () => {
  it('joins the legs: 3 m + 3 m make 6 m of ascent', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 103]), trace([['road', 0, 0.03]])),
      pathLeg(ok([103, 106]), trace([['road', 0, 0.03]])),
    ]);
    expect(info.altitudes).toMatchObject({
      status: 'ready',
      ascentM: 6,
      descentM: 0,
      minM: 100,
      maxM: 106,
    });
  });
  it('counts the altitudes of a hand leg in the ascent and the profile (C4)', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 103]), trace([['road', 0, 0.03]])),
      handInfo(ok([103, 106]), 0.03),
    ]);
    expect(info.altitudes).toMatchObject({ status: 'ready', ascentM: 6 });
    if (info.altitudes.status !== 'ready') throw new Error('not ready');
    expect(info.altitudes.profile).toHaveLength(4);
  });
  it('a received profile with a null is missing, even if another is pending', () => {
    const t = trace([['road', 0, 1]]);
    expect(
      summarizeInfo([pathLeg(ok([100, null]), t), pathLeg(undefined, t)])
        .altitudes.status,
    ).toBe('missing');
  });
  it('is all or nothing on altitudes', () => {
    const t = trace([['road', 0, 1]]);
    expect(
      summarizeInfo([pathLeg(ok([100, 110]), t), pathLeg(failed, t)]).altitudes,
    ).toEqual({ status: 'missing' });
    expect(
      summarizeInfo([pathLeg(ok([100, 110]), t), pathLeg(ok([110, null]), t)])
        .altitudes,
    ).toEqual({ status: 'missing' });
  });
  it('keeps the terrain when the altitudes are missing, and the reverse', () => {
    const info = summarizeInfo([pathLeg(failed, trace([['track', 0, 1]]))]);
    expect(info.altitudes.status).toBe('missing');
    expect(info.terrain).toMatchObject({ status: 'ready', segments: [] });
    const info2 = summarizeInfo([pathLeg(ok([1, 2]), failed)]);
    expect(info2.altitudes.status).toBe('ready');
    expect(info2.terrain.status).toBe('missing');
  });
  it('is pending while a request runs, and missing wins over pending', () => {
    const t = trace([['road', 0, 1]]);
    const info = summarizeInfo([pathLeg(undefined, t), pathLeg(ok([1, 2]), t)]);
    expect(info.altitudes.status).toBe('pending');
    expect(
      summarizeInfo([pathLeg(undefined, t), pathLeg(failed, t)]).altitudes
        .status,
    ).toBe('missing');
    expect(summarizeInfo([pathLeg(ok([1, 2]), undefined)]).terrain.status).toBe(
      'pending',
    );
  });
  it('has missing blocks and no error on an empty route', () => {
    expect(summarizeInfo([])).toMatchObject({
      altitudes: { status: 'missing' },
      terrain: { status: 'missing' },
      handKm: 0,
    });
  });
  it('adds the hand leg as a 4th share and a segment', () => {
    const info = summarizeInfo([
      pathLeg(ok([100, 100, 100, 100]), trace([['road', 0, 0.09]])),
      handInfo(ok([100, 100, 100]), 0.06),
    ]);
    if (info.terrain.status !== 'ready') throw new Error('not ready');
    expect(info.terrain.shares).toEqual([
      { part: 'road', percent: 60 },
      { part: 'track', percent: 0 },
      { part: 'trail', percent: 0 },
      { part: 'hand', percent: 40 },
    ]);
    expect(info.terrain.segments).toEqual([
      { part: 'road', fromM: 0, toM: 90 },
      { part: 'hand', fromM: 90, toM: 150 },
    ]);
    expect(info.handKm).toBeCloseTo(0.06);
  });
  it('has no difficulty field (C11)', () => {
    const info = summarizeInfo([pathLeg(ok([1, 2]), trace([['road', 0, 1]]))]);
    expect(JSON.stringify(info).toLowerCase()).not.toMatch(
      /difficult|difficulty/,
    );
  });
});

describe('handLengthKm / infoShape', () => {
  const draft: Draft = {
    points: [
      { id: 1, lon: 6.1, lat: 48.6 },
      { id: 2, lon: 6.11, lat: 48.6 },
      { id: 3, lon: 6.12, lat: 48.6 },
      { id: 4, lon: 7.5, lat: 48.6 },
    ],
    modes: ['path', 'hand', 'hand'],
  };
  const legs = listLegs(draft);
  it('sums the hand legs only', () => {
    const expected =
      (distanceMeters(draft.points[1]!, draft.points[2]!) +
        distanceMeters(draft.points[2]!, draft.points[3]!)) /
      1000;
    expect(handLengthKm(legs)).toBeCloseTo(expected, 6);
  });
  it('gives the route shape of a calculated leg, null while unknown', () => {
    const shape: [number, number][] = [
      [6.1, 48.6],
      [6.11, 48.6],
    ];
    expect(infoShape(legs[0]!, { shape }, bbox)).toBe(shape);
    expect(infoShape(legs[0]!, undefined, bbox)).toBeNull();
  });
  it('gives the straight line of a hand leg inside the zone', () => {
    expect(infoShape(legs[1]!, undefined, bbox)).toEqual([
      [6.11, 48.6],
      [6.12, 48.6],
    ]);
  });
  it('gives null for a hand leg starting outside the zone', () => {
    const out: Draft = {
      points: [
        { id: 1, lon: 7.5, lat: 48.6 },
        { id: 2, lon: 6.1, lat: 48.6 },
      ],
      modes: ['hand'],
    };
    expect(infoShape(listLegs(out)[0]!, undefined, bbox)).toBeNull();
  });
  it('gives null for a hand leg with an end outside the zone', () => {
    expect(infoShape(legs[2]!, undefined, bbox)).toBeNull();
  });
});
