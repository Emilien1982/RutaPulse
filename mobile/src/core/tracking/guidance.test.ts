import fs from 'fs';
import path from 'path';

import {
  parseMatchedEdges,
  parseTraceRouteResponse,
  type Maneuver,
} from '@/core/routing/guidanceResponse';
import { encodePolyline6 } from '@/core/routing/routeResponse';
import type { LonLat } from '@/core/routes/savedRoute';
import { trackLengthM } from '@/core/gpx/trackLengthM';

import { directionLabel, type Direction } from './directionText';
import {
  buildGuidance,
  gestureOfType,
  partShape,
  type PartAnswer,
} from './guidance';
import { lineOf, outAndBack, dense, toLonLat } from './testing/fabricate';
import {
  RECORDED_NAMES,
  RECORDED_TITLES,
  recorded,
  type RecordedName,
} from './testing/recorded';
import {
  buildLine,
  distanceM,
  guidedParts,
  sourceOfCreated,
  type TrackingSource,
} from './trackingLine';

const positionOf = (d: Direction): number =>
  d.kind === 'follow' ? d.fromM : d.atM;

describe('C2: directions written from the recorded answers of the engine', () => {
  it.each(RECORDED_NAMES)(
    'itinerary %s: the same list as the reference, in order',
    (name) => {
      const { source, answer, reference } = recorded(name);
      const directions = buildGuidance(source, [answer]);
      expect(directions.map(directionLabel)).toEqual(
        reference.directions.map((d) => d.text),
      );
      directions.forEach((d, i) => {
        // the reference measures the places on our line, with its own code
        expect(
          Math.abs(positionOf(d) - (reference.directions[i]?.atM ?? 1e9)),
        ).toBeLessThan(20);
      });
    },
  );

  it.each(RECORDED_NAMES)('itinerary %s: nothing absurd', (name) => {
    const { source, answer } = recorded(name);
    const directions = buildGuidance(source, [answer]);
    const positions = directions.map(positionOf);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // the arrival is ours, at the end of our line, and only once
    const last = directions[directions.length - 1];
    expect(last).toEqual({ kind: 'arrive', atM: source.line.lengthM });
    expect(directions.filter((d) => d.kind === 'arrive')).toHaveLength(1);
    // no "straight on" twice in a row, no U-turn on a line that does not turn back
    const turns = directions.filter((d) => d.kind === 'turn');
    turns.forEach((d, i) => {
      if (d.kind === 'turn' && d.gesture === 'straight') {
        const before = turns[i - 1];
        expect(before?.kind === 'turn' && before.gesture === 'straight').toBe(
          false,
        );
      }
      expect(d.kind === 'turn' && d.gesture === 'uturn').toBe(false);
    });
    // no street name, never a start or an arrival of the engine
    expect(directions.map(directionLabel).join('\n')).not.toMatch(
      /Pédalez|destination|dans (Rue|Chemin|Avenue)/,
    );
  });

  it('itinerary 1 (created) and 2 (circuit): the engine is trusted everywhere', () => {
    for (const name of ['1', '2'] as RecordedName[]) {
      const { source, answer } = recorded(name);
      const directions = buildGuidance(source, [answer]);
      expect(directions.some((d) => d.kind === 'follow')).toBe(false);
    }
  });

  it('GPX: no ghost U-turn, "follow the track" on the last 741 m, arrival at the end', () => {
    const { source, answer } = recorded('3');
    // the engine does say "u-turn" (12 or 13) somewhere: it is the ghost one
    const trace = answer.trace;
    if (!trace || !trace.ok) throw new Error('not read');
    expect(trace.maneuvers.some((m) => m.type === 12 || m.type === 13)).toBe(
      true,
    );
    const directions = buildGuidance(source, [answer]);
    expect(
      directions.some((d) => d.kind === 'turn' && d.gesture === 'uturn'),
    ).toBe(false);
    const follow = directions.filter((d) => d.kind === 'follow');
    expect(follow).toHaveLength(1);
    const tail = follow[0];
    if (tail?.kind !== 'follow') throw new Error('no stretch');
    expect(tail.reason).toBe('noMatch');
    // the trial measured 741 m more than 20 m from the matched path, at the end
    expect(source.line.lengthM - tail.fromM).toBeGreaterThan(700);
    expect(source.line.lengthM - tail.fromM).toBeLessThan(800);
    expect(tail.toM).toBeCloseTo(source.line.lengthM, 0);
    // the engine's own arrival is gone: ours comes last, at the end of the line
    expect(directions[directions.length - 1]).toEqual({
      kind: 'arrive',
      atM: source.line.lengthM,
    });
    // no turn in the stretch the engine did not match
    expect(
      directions.filter((d) => d.kind === 'turn' && d.atM > tail.fromM),
    ).toEqual([]);
  });

  it('the kind of way is given where both shapes agree, and not beyond', () => {
    const labels = (name: RecordedName) => {
      const { source, answer } = recorded(name);
      return buildGuidance(source, [answer]).map(directionLabel);
    };
    // circuit and created route: the two shapes are the same, every turn has its way
    expect(
      labels('1').every(
        (l) => /sur (le|la)/.test(l) || /rond-point|Arrivée/.test(l),
      ),
    ).toBe(true);
    // noisy GPX: the shapes part at the ghost U-turn, the later turns have no way
    const gpx = labels('3');
    expect(gpx.some((l) => /sur la piste/.test(l))).toBe(true);
    expect(gpx.filter((l) => l === 'Tournez à gauche').length).toBeGreaterThan(
      5,
    );
  });

  it('writes the lists for the reading of the pilot when WRITE_DIRECTIONS is set', () => {
    if (!process.env.WRITE_DIRECTIONS) return;
    const folder = path.resolve(
      __dirname,
      '../../../../docs/phases/preuves/p08a',
    );
    fs.mkdirSync(folder, { recursive: true });
    const files: Record<RecordedName, string> = {
      '1': 'itineraire-cree',
      '2': 'circuit-haye',
      '3': 'gpx-simule',
      '3d': 'gpx-simule-sans-bruit',
    };
    for (const name of RECORDED_NAMES) {
      const { source, answer } = recorded(name);
      const directions = buildGuidance(source, [answer]);
      const km = (m: number) => (m / 1000).toFixed(2).replace('.', ',');
      const rows = directions.map((d, i) => {
        const next = directions[i + 1];
        const from = positionOf(d);
        const gap = next ? `${Math.round(positionOf(next) - from)} m` : '—';
        const text =
          d.kind === 'follow'
            ? `Suivez le tracé (jusqu'à ${km(d.toM)} km, passage non recalé par le moteur)`
            : directionLabel(d);
        return `| ${i + 1} | ${km(from)} | ${text} | ${gap} |`;
      });
      const turns = directions.filter((d) => d.kind === 'turn').length;
      const pairs = directions.filter(
        (d) => d.kind === 'turn' && d.then,
      ).length;
      const follows = directions.filter((d) => d.kind === 'follow').length;
      fs.writeFileSync(
        path.join(folder, `directions-${files[name]}.md`),
        [
          `# Directions écrites : ${RECORDED_TITLES[name]}`,
          '',
          'Liste produite par `buildGuidance` (ADR 0021) à partir de la réponse enregistrée du moteur',
          `(fixtures de \`mobile/src/core/tracking/fixtures/\`). Ligne de ${km(source.line.lengthM)} km, ` +
            `${directions.length} lignes : ${turns} consignes de virage (dont ${pairs} annonces groupées de deux virages à moins de 25 m), ` +
            `${follows} « Suivez le tracé », 1 arrivée.`,
          '',
          '| # | Position (km) | Consigne | Distance jusqu’à la suivante |',
          '|---|---|---|---|',
          ...rows,
          '',
        ].join('\n'),
      );
    }
  });
});

describe('gestureOfType (table of ADR 0021, section 1.4)', () => {
  it.each([
    [9, 'slight', 'right'],
    [16, 'slight', 'left'],
    [10, 'turn', 'right'],
    [15, 'turn', 'left'],
    [11, 'sharp', 'right'],
    [14, 'sharp', 'left'],
    [23, 'fork', 'right'],
    [24, 'fork', 'left'],
    [22, 'straight', undefined],
    [12, 'uturn', 'right'],
    [13, 'uturn', 'left'],
    [26, 'roundabout', undefined],
    [18, 'slight', 'right'],
    [20, 'slight', 'right'],
    [37, 'slight', 'right'],
    [19, 'slight', 'left'],
    [21, 'slight', 'left'],
    [38, 'slight', 'left'],
  ])('type %i is %s %s', (type, gesture, side) => {
    expect(gestureOfType(type)).toEqual({
      gesture,
      ...(side ? { side } : {}),
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 17, 25, 27, 28, 29, 99])(
    'type %i is dropped',
    (type) => {
      expect(gestureOfType(type)).toBeNull();
    },
  );
});

// A made-up answer of the engine: the matched shape is the line itself.
function answerOn(
  points: LonLat[],
  maneuvers: Maneuver[],
  edgeUse?: string,
): PartAnswer {
  const line = encodePolyline6(points);
  return {
    trace: parseTraceRouteResponse(
      JSON.stringify({
        trip: {
          legs: [
            {
              shape: line,
              maneuvers: maneuvers.map((m) => ({
                type: m.type,
                begin_shape_index: m.beginShapeIndex,
                ...(m.exitCount ? { roundabout_exit_count: m.exitCount } : {}),
              })),
            },
          ],
        },
      }),
    ),
    edges: edgeUse
      ? parseMatchedEdges(
          JSON.stringify({
            shape: line,
            edges: [{ use: edgeUse, density: 1, begin_shape_index: 0 }],
          }),
        )
      : null,
  };
}

describe('the control of the answer (ADR 0021, section 1.3)', () => {
  // 2 km to the east, a point every 20 m
  const straight = lineOf(
    dense(
      [
        [0, 0],
        [2000, 0],
      ],
      20,
    ),
  );
  const sourceOf = (points: LonLat[]): TrackingSource => ({
    line: buildLine(points),
    free: [],
  });
  const labels = (d: Direction[]) => d.map(directionLabel);

  it('keeps a U-turn only when the line turns back', () => {
    const points = lineOf(dense(outAndBack(1000), 20));
    const apex = 50; // index of the point at 1 000 m
    const middle = 25;
    const ok = buildGuidance(sourceOf(points), [
      answerOn(points, [{ type: 13, beginShapeIndex: apex }]),
    ]);
    expect(labels(ok)).toEqual(['Faites demi-tour', 'Arrivée']);
    // a U-turn in the middle of the straight way out is a ghost
    const ghost = buildGuidance(sourceOf(points), [
      answerOn(points, [{ type: 12, beginShapeIndex: middle }]),
    ]);
    expect(labels(ghost)).toEqual(['Arrivée']);
  });

  it('drops a maneuver more than 20 m from our line, keeps one at 15 m', () => {
    const near = { ...answerOn(straight, [{ type: 10, beginShapeIndex: 50 }]) };
    const source = sourceOf(straight);
    expect(labels(buildGuidance(source, [near]))).toEqual([
      'Tournez à droite',
      'Arrivée',
    ]);
    // the engine's shape is 15 m, then 30 m to the north of our line
    const shifted = (north: number) =>
      lineOf(
        dense(
          [
            [0, north],
            [2000, north],
          ],
          20,
        ),
      );
    const at15 = answerOn(shifted(15), [{ type: 10, beginShapeIndex: 50 }]);
    expect(labels(buildGuidance(source, [at15]))).toEqual([
      'Tournez à droite',
      'Arrivée',
    ]);
    const at30 = answerOn(shifted(30), [{ type: 10, beginShapeIndex: 50 }]);
    // all of the engine's shape is farther than 20 m from our line: nothing is matched
    expect(labels(buildGuidance(source, [at30]))).toEqual([
      'Suivez le tracé',
      'Arrivée',
    ]);
  });

  it('turns a stretch farther than 20 m from the matched shape (over 100 m) into "follow the track"', () => {
    // the engine matched only the first 1 000 m
    const source = sourceOf(straight);
    const half = straight.slice(0, 51);
    const answer = answerOn(half, [{ type: 10, beginShapeIndex: 25 }]);
    const directions = buildGuidance(source, [answer]);
    expect(labels(directions)).toEqual([
      'Tournez à droite',
      'Suivez le tracé',
      'Arrivée',
    ]);
    const follow = directions[1];
    if (follow?.kind !== 'follow') throw new Error('no stretch');
    expect(follow.reason).toBe('noMatch');
    expect(follow.fromM).toBeGreaterThan(990);
    expect(follow.fromM).toBeLessThanOrEqual(1040);
    expect(follow.toM).toBeCloseTo(source.line.lengthM, 0);
  });

  it('leaves a gap of 100 m or less guided', () => {
    const source = sourceOf(straight);
    // the matched shape misses 80 m in the middle of the line
    const matched = [...straight.slice(0, 40), ...straight.slice(45)];
    const answer = answerOn(matched, [{ type: 10, beginShapeIndex: 60 }]);
    expect(labels(buildGuidance(source, [answer]))).toEqual([
      'Tournez à droite',
      'Arrivée',
    ]);
  });

  it('makes the whole part "follow the track" when the engine failed or did not answer', () => {
    const source = sourceOf(straight);
    const failed: PartAnswer = {
      trace: { ok: false, error: 'failed' },
      edges: null,
    };
    for (const answers of [
      [failed],
      [null],
      [],
      [{ trace: null, edges: null }],
    ]) {
      const directions = buildGuidance(source, answers);
      expect(labels(directions)).toEqual(['Suivez le tracé', 'Arrivée']);
      expect(directions[0]).toEqual({
        kind: 'follow',
        fromM: 0,
        toM: source.line.lengthM,
        reason: 'noMatch',
      });
    }
  });

  it('gives the kind of way only when the shapes of the two answers agree', () => {
    const source = sourceOf(straight);
    const maneuvers = [
      { type: 15, beginShapeIndex: 0 },
      { type: 10, beginShapeIndex: 50 },
    ];
    const trail = answerOn(straight, maneuvers, 'path');
    const edgeAt50 = (shape: LonLat[]) =>
      parseMatchedEdges(
        JSON.stringify({
          shape: encodePolyline6(shape),
          edges: [
            { use: 'path', density: 1, begin_shape_index: 0 },
            { use: 'track', density: 1, begin_shape_index: 50 },
          ],
        }),
      );
    const answer = { ...trail, edges: edgeAt50(straight) };
    expect(labels(buildGuidance(source, [answer]))).toEqual([
      'Tournez à gauche sur le sentier',
      'Tournez à droite sur la piste',
      'Arrivée',
    ]);
    // the second shape is not the first: no kind of way beyond the first point
    const other = straight.map((p, i): LonLat =>
      i < 10 ? p : [p[0], p[1] + 1e-5],
    );
    expect(
      labels(buildGuidance(source, [{ ...trail, edges: edgeAt50(other) }])),
    ).toEqual([
      'Tournez à gauche sur le sentier',
      'Tournez à droite',
      'Arrivée',
    ]);
    // no answer for the ways: the gesture alone
    expect(labels(buildGuidance(source, [{ ...trail, edges: null }]))).toEqual([
      'Tournez à gauche',
      'Tournez à droite',
      'Arrivée',
    ]);
  });

  it('writes the exit of a roundabout, with no kind of way', () => {
    const source = sourceOf(straight);
    const answer = answerOn(
      straight,
      [{ type: 26, beginShapeIndex: 50, exitCount: 3 }],
      'path',
    );
    expect(labels(buildGuidance(source, [answer]))).toEqual([
      'Au rond-point, 3e sortie',
      'Arrivée',
    ]);
  });

  it('keeps only the turns, not the starts, the arrivals and the changes of name', () => {
    const source = sourceOf(straight);
    const answer = answerOn(straight, [
      { type: 1, beginShapeIndex: 0 },
      { type: 8, beginShapeIndex: 20 },
      { type: 7, beginShapeIndex: 30 },
      { type: 22, beginShapeIndex: 40 },
      { type: 27, beginShapeIndex: 60 },
      { type: 4, beginShapeIndex: 100 },
    ]);
    expect(labels(buildGuidance(source, [answer]))).toEqual([
      'Continuez tout droit',
      'Arrivée',
    ]);
  });
});

describe('free stretches (by hand, out of the zone)', () => {
  const bbox = { lonMin: 6, latMin: 48, lonMax: 7, latMax: 49 };
  const north = (lat: number): LonLat => [6.5, lat];
  const draft = {
    points: [48, 48.01, 48.02, 48.03].map((lat, i) => ({
      id: i + 1,
      lon: 6.5,
      lat,
    })),
    modes: ['path', 'hand', 'path'] as ('path' | 'hand')[],
  };
  const pathLeg = (shape: LonLat[]) => ({
    mode: 'path' as const,
    zoneVersion: 1,
    distanceKm: 1,
    durationS: 1,
    shape,
  });
  const first = [north(48), north(48.005), north(48.0101)];
  const last = [north(48.0199), north(48.025), north(48.03)];

  it('says "follow the track" on the hand leg, and guides the rest', () => {
    const source = sourceOfCreated(
      draft,
      [pathLeg(first), { mode: 'hand' }, pathLeg(last)],
      bbox,
    );
    const parts = guidedParts(source.line, source.free);
    expect(parts).toHaveLength(2);
    const answers = parts.map((part) => {
      const shape = partShape(source.line, part);
      return answerOn(shape, [{ type: 10, beginShapeIndex: 5 }]);
    });
    const directions = buildGuidance(source, answers);
    expect(directions.map(directionLabel)).toEqual([
      'Tournez à droite',
      'Suivez le tracé',
      'Tournez à droite',
      'Arrivée',
    ]);
    const follow = directions[1];
    expect(follow).toMatchObject({ kind: 'follow', reason: 'hand' });
    // the turns are in their own part
    const [a, b, c] = [directions[0], directions[1], directions[2]].map(
      positionOf,
    );
    expect(a).toBeLessThan((a as number) + 1);
    expect(b as number).toBeCloseTo(distanceM(north(48), north(48.0101)), 0);
    expect(c as number).toBeGreaterThan(distanceM(north(48), north(48.0199)));
  });

  it('says "follow the track" out of the zone, with its reason', () => {
    const outside = [north(48.0199), north(49.4), north(49.5)];
    const source = sourceOfCreated(
      draft,
      [pathLeg(first), { mode: 'hand' }, pathLeg(outside)],
      bbox,
    );
    const parts = guidedParts(source.line, source.free);
    expect(parts).toHaveLength(1);
    const directions = buildGuidance(source, [
      answerOn(
        partShape(source.line, parts[0] as { fromM: number; toM: number }),
        [],
      ),
    ]);
    expect(
      directions.map((d) => (d.kind === 'follow' ? d.reason : d.kind)),
    ).toEqual(['hand', 'outOfZone', 'arrive']);
  });

  it('says "follow the track" on all the line when no zone is in service', () => {
    const source = sourceOfCreated(
      draft,
      [pathLeg(first), { mode: 'hand' }, pathLeg(last)],
      null,
    );
    expect(guidedParts(source.line, source.free)).toEqual([]);
    const directions = buildGuidance(source, []);
    expect(
      directions.map((d) => (d.kind === 'follow' ? d.reason : d.kind)),
    ).toEqual(['outOfZone', 'arrive']);
  });
});

describe('two turns less than 25 m apart', () => {
  const straight = lineOf(
    dense(
      [
        [0, 0],
        [2000, 0],
      ],
      20,
    ),
  );
  const source: TrackingSource = { line: buildLine(straight), free: [] };
  const run = (turns: [number, number][]) =>
    buildGuidance(source, [
      answerOn(
        straight,
        turns.map(([type, beginShapeIndex]) => ({ type, beginShapeIndex })),
      ),
    ]).map(directionLabel);

  it('announces them together, in one entry at the place of the first', () => {
    // 20 m apart (one point): left then right
    const directions = buildGuidance(source, [
      answerOn(straight, [
        { type: 15, beginShapeIndex: 30 },
        { type: 10, beginShapeIndex: 31 },
      ]),
    ]);
    expect(directions).toHaveLength(2);
    expect(directionLabel(directions[0] as Direction)).toBe(
      'Tournez à gauche, puis à droite',
    );
    expect(positionOf(directions[0] as Direction)).toBeCloseTo(600, -1);
  });

  it('keeps two turns 40 m apart separate', () => {
    expect(
      run([
        [15, 30],
        [10, 32],
      ]),
    ).toHaveLength(3);
  });

  it('never makes a chain of three: the third stays alone', () => {
    expect(
      run([
        [15, 30],
        [10, 31],
        [15, 32],
      ]),
    ).toEqual([
      'Tournez à gauche, puis à droite',
      'Tournez à gauche',
      'Arrivée',
    ]);
  });

  it('writes the second turn without "Tournez" and in lower case', () => {
    expect(
      run([
        [10, 30],
        [16, 31],
      ])[0],
    ).toBe('Tournez à droite, puis légèrement à gauche');
  });

  it('never joins a turn to the arrival or to a stretch to follow', () => {
    // a turn 10 m before the end of the line
    const end = buildGuidance(source, [
      answerOn(straight, [{ type: 10, beginShapeIndex: 99 }]),
    ]);
    expect(end.map(directionLabel)).toEqual(['Tournez à droite', 'Arrivée']);
    // a turn just before the stretch the engine did not match
    const half = straight.slice(0, 51);
    const joined = buildGuidance(source, [
      answerOn(half, [{ type: 10, beginShapeIndex: 49 }]),
    ]);
    expect(joined.map((d) => d.kind)).toEqual(['turn', 'follow', 'arrive']);
    expect((joined[0] as { then?: unknown }).then).toBeUndefined();
  });
});

describe('partShape', () => {
  it('gives a point every 20 m, with the ends', () => {
    const line = buildLine(
      lineOf([
        [0, 0],
        [1000, 0],
      ]),
    );
    const shape = partShape(line, { fromM: 100, toM: 500 });
    expect(shape.length).toBeGreaterThanOrEqual(21);
    expect(shape.length).toBeLessThanOrEqual(22);
    expect(trackLengthM(shape)).toBeCloseTo(400, 0);
    expect(distanceM(shape[0] as LonLat, toLonLat([100, 0]))).toBeLessThan(0.5);
    expect(distanceM(shape[1] as LonLat, shape[2] as LonLat)).toBeCloseTo(
      20,
      0,
    );
  });
});
