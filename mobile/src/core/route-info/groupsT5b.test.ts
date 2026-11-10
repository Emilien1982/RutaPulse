// Altitudes by group of trace legs (ADR 0020, sections 5 and 6).
import { infoShape } from './legShape';
import { summarizeInfo, type LegInfo } from './routeInfo';

const bbox = { lonMin: 5, latMin: 48, lonMax: 7, latMax: 49 };
const leg = {
  index: 0,
  mode: 'path' as const,
  from: { id: 1, lon: 6, lat: 48.5 },
  to: { id: 2, lon: 6.1, lat: 48.5 },
};

describe('infoShape of a leg kept from a trace', () => {
  it('gives its shape inside the zone', () => {
    const shape: [number, number][] = [
      [6, 48.5],
      [6.1, 48.5],
    ];
    expect(infoShape(leg, { shape, trace: true }, bbox)).toBe(shape);
  });

  it('gives null when a point is outside the zone rectangle, but not for an engine leg', () => {
    const shape: [number, number][] = [
      [6, 48.5],
      [7.5, 48.5],
    ];
    expect(infoShape(leg, { shape, trace: true }, bbox)).toBeNull();
    expect(infoShape(leg, { shape }, bbox)).toBe(shape);
  });
});

describe('summarizeInfo with a group', () => {
  const edge = { use: 'path', density: 1, lengthKm: 1, wayId: 1 };
  const terrain = { ok: true as const, edges: [edge] };
  const group: LegInfo[] = [
    {
      mode: 'path',
      handKm: 0,
      height: {
        ok: true,
        profile: [
          [0, 100],
          [1000, 130],
          [2000, 160],
        ],
      },
      terrain,
      shapeLengthM: 1000,
    },
    {
      mode: 'path',
      handKm: 0,
      height: { ok: true, profile: [] },
      terrain,
      shapeLengthM: 1000,
      inGroup: true,
    },
  ];

  it('takes one profile per group: D+ and terrain along its length', () => {
    const info = summarizeInfo(group);
    expect(info.altitudes).toMatchObject({ status: 'ready', ascentM: 60 });
    expect(info.terrain.status).toBe('ready');
    if (info.terrain.status === 'ready') {
      expect(info.terrain.segments[info.terrain.segments.length - 1].toM).toBe(
        2000,
      );
    }
  });

  it('waits while the group profile is not there, and fails when it failed', () => {
    const waiting = [{ ...group[0], height: undefined }, group[1]];
    expect(summarizeInfo(waiting).altitudes.status).toBe('pending');
    const failed = [
      { ...group[0], height: { ok: false as const, error: 'failed' as const } },
      group[1],
    ];
    expect(summarizeInfo(failed).altitudes.status).toBe('missing');
  });
});
