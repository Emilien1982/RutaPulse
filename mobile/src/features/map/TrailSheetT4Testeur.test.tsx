// Tester tests, written from the spec (phase 7 C5, ADR 0020 section 9,
// mockup 12 screens 2 to 5 and variants A to G).

import { fireEvent, render, screen } from '@testing-library/react-native';

import { trailsFile } from '@/core/trails/testing';
import { parseTrails, type Trail } from '@/core/trails/trails';
import type { Zone } from '@/core/zones/catalogue';

import { TrailPanel, TrailSheet } from './TrailSheet';

let mockCatalogue: Record<string, unknown> = {};
jest.mock('@/shared-data/zones/useCatalogue', () => ({
  useCatalogue: () => mockCatalogue,
}));

function zone(version: number): Zone {
  return {
    id: 'nancy',
    name: 'Nancy et forêt de Haye',
    version,
    bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 108_000_000,
    files: [],
  };
}

const LINE: [number, number][] = [
  [6.0, 48.0],
  [6.2, 48.0],
];

function trail(f: Parameters<typeof trailsFile>[0][number]): Trail {
  return parseTrails(trailsFile([{ ways: [LINE], ...f }]))[0];
}

const h = {
  onClose: jest.fn(),
  onMake: jest.fn(),
  onUpdateZone: jest.fn(),
  onSeeZones: jest.fn(),
};

async function show(
  t: Trail,
  hasPosition = true,
  phase?: 'running' | 'failed',
) {
  await render(
    <TrailSheet
      trail={t}
      zone={zone(5)}
      hasPosition={hasPosition}
      phase={phase}
      {...h}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogue = { data: { zones: [zone(6)] }, fetchStatus: 'idle' };
});

describe('case 1: ordered line', () => {
  const ordered = trail({
    osm_id: 1,
    ref: '7',
    ordered: LINE,
    loop: false,
    ordered_m: 18600,
    removed_m: 0,
  });
  it('shows ref title, length, one way, attribution, button', async () => {
    await show(ordered);
    expect(screen.getByText('Circuit 7')).toBeTruthy();
    expect(
      screen
        .getByTestId('trail-summary')
        .props.children.toString()
        .replace(/[\u202F\u00A0]/g, ' '),
    ).toBe('18,6 km · aller simple');
    expect(screen.getByText(/Tracé du circuit.*OpenStreetMap/)).toBeTruthy();
    expect(screen.getByText('En faire un itinéraire')).toBeTruthy();
    expect(screen.queryByText(/variantes/)).toBeNull();
  });
  it('mentions the dropped variants only when removed_m > 0', async () => {
    await show({
      ...ordered,
      line: { ...(ordered.line as any), removedM: 1200 },
    });
    expect(
      screen.getByText(/Les petites variantes du circuit ne sont pas reprises/),
    ).toBeTruthy();
  });
  it('loop: start nearest when position known, else beginning', async () => {
    const loop = trail({
      osm_id: 2,
      name: 'Boucle',
      ordered: LINE,
      loop: true,
      ordered_m: 34904,
      removed_m: 0,
    });
    await show(loop, true);
    expect(screen.getByText(/le point du circuit le plus proche/)).toBeTruthy();
  });
  it('loop without position: start at the beginning, because unknown', async () => {
    const loop = trail({
      osm_id: 2,
      name: 'Boucle',
      ordered: LINE,
      loop: true,
      ordered_m: 34904,
      removed_m: 0,
    });
    await show(loop, false);
    expect(screen.getByText(/position est inconnue/)).toBeTruthy();
  });
  it('the button calls onMake', async () => {
    await show(ordered);
    fireEvent.press(screen.getByText('En faire un itinéraire'));
    expect(h.onMake).toHaveBeenCalledTimes(1);
  });
});

describe('case 2 and 3: refused circuits', () => {
  it.each(['parts', 'branches', 'removedTooMuch'])(
    'refusal %s: length_m, a message, no button',
    async (reason) => {
      await show(
        trail({
          osm_id: 3,
          name: 'Morceaux',
          length_m: 22500,
          ordered: null,
          refusal: reason,
        }),
      );
      expect(screen.getByText(/environ 2[23][\u202F\u00A0 ]km/)).toBeTruthy();
      expect(
        screen.getByText(/ne peut pas devenir un itinéraire/),
      ).toBeTruthy();
      expect(screen.queryByText('En faire un itinéraire')).toBeNull();
      expect(screen.getByText(/OpenStreetMap/)).toBeTruthy();
    },
  );
});

describe('case 4: old zone (no `ordered` key)', () => {
  const old = trail({ osm_id: 4, name: 'Ancien', length_m: 12000 });
  it('says "Zone à mettre à jour." and offers the update with its size', async () => {
    await show(old);
    expect(screen.getByText('Zone à mettre à jour.')).toBeTruthy();
    expect(screen.getByText(/environ 12[\u202F\u00A0 ]km/)).toBeTruthy();
    expect(screen.queryByText('En faire un itinéraire')).toBeNull();
    fireEvent.press(screen.getByTestId('trail-update'));
    expect(h.onUpdateZone).toHaveBeenCalledWith(
      expect.objectContaining({ version: 6 }),
    );
  });
  it('catalogue loading: no claim of being offline, no update button', async () => {
    mockCatalogue = {
      data: undefined,
      isError: false,
      fetchStatus: 'fetching',
    };
    await show(old);
    expect(screen.queryByText(/Sans réseau/)).toBeNull();
    expect(screen.queryByTestId('trail-update')).toBeNull();
    expect(screen.getByText('Zone à mettre à jour.')).toBeTruthy();
  });
  it('catalogue unreadable: "Sans réseau" and "Voir les zones"', async () => {
    mockCatalogue = { data: undefined, isError: true, fetchStatus: 'idle' };
    await show(old);
    expect(screen.getByText(/Sans réseau/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('trail-see-zones'));
    expect(h.onSeeZones).toHaveBeenCalled();
    expect(screen.queryByTestId('trail-update')).toBeNull();
  });
  it('catalogue paused (no network): offline wording', async () => {
    mockCatalogue = { data: undefined, isError: false, fetchStatus: 'paused' };
    await show(old);
    expect(screen.getByText(/Sans réseau/)).toBeTruthy();
  });
  it('update running: "Mise à jour en cours." and "Voir les zones"', async () => {
    await show(old, true, 'running');
    expect(screen.getByText('Mise à jour en cours.')).toBeTruthy();
    expect(screen.getByTestId('trail-see-zones')).toBeTruthy();
    expect(screen.queryByTestId('trail-update')).toBeNull();
  });
  it('update failed: does not say it is running', async () => {
    await show(old, true, 'failed');
    expect(screen.queryByText('Mise à jour en cours.')).toBeNull();
    expect(screen.getByTestId('trail-see-zones')).toBeTruthy();
  });
  it('no newer version in the catalogue: variant F, no button at all', async () => {
    mockCatalogue = { data: { zones: [zone(5)] }, fetchStatus: 'idle' };
    await show(old);
    expect(
      screen.getByText('Ce circuit ne peut pas encore devenir un itinéraire.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('trail-update')).toBeNull();
    expect(screen.queryByTestId('trail-see-zones')).toBeNull();
  });
});

describe('list "{n} circuits passent ici" (variant G)', () => {
  const a = trail({
    osm_id: 10,
    name: 'Petite Suisse',
    ordered: LINE,
    loop: true,
    ordered_m: 34904,
    removed_m: 0,
  });
  const b = trail({ osm_id: 20, ref: '2', length_m: 8000 });
  it('shows the count and the rows in the given order; a row chooses', async () => {
    const onChoose = jest.fn();
    await render(
      <TrailPanel many={{ trails: [a, b], onChoose, onClose: h.onClose }} />,
    );
    expect(screen.getByText('2 circuits passent ici')).toBeTruthy();
    expect(screen.getByText('Petite Suisse')).toBeTruthy();
    expect(screen.getByText('Circuit 2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('trail-row-20'));
    expect(onChoose).toHaveBeenCalledWith(b);
  });
  it('3 circuits: "3 circuits passent ici"', async () => {
    await render(
      <TrailPanel
        many={{ trails: [a, b, a], onChoose: jest.fn(), onClose: h.onClose }}
      />,
    );
    expect(screen.getByText('3 circuits passent ici')).toBeTruthy();
  });
});
