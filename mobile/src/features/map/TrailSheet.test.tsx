import { fireEvent, render, screen } from '@testing-library/react-native';

import { trailsFile } from '@/core/trails/testing';
import { parseTrails, type Trail } from '@/core/trails/trails';
import type { Zone } from '@/core/zones/catalogue';
import type { UpdatePhase } from '@/core/trails/updateOffer';

import { TrailListSheet, TrailSheet } from './TrailSheet';

let mockCatalogue: {
  data?: { zones: Zone[] };
  isError?: boolean;
  fetchStatus?: string;
} = {};
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

function trailOf(feature: Parameters<typeof trailsFile>[0][number]): Trail {
  return parseTrails(trailsFile([{ ways: [LINE], ...feature }]))[0];
}

const loop = trailOf({
  osm_id: 1,
  name: 'Petite Suisse Lorraine à VTT',
  ordered: LINE,
  loop: true,
  ordered_m: 34904,
  removed_m: 0,
});

const handlers = {
  onClose: jest.fn(),
  onMake: jest.fn(),
  onUpdateZone: jest.fn(),
  onSeeZones: jest.fn(),
};

async function show(
  trail: Trail,
  options: {
    hasPosition?: boolean;
    phase?: UpdatePhase;
  } = {},
) {
  await render(
    <TrailSheet
      trail={trail}
      zone={zone(5)}
      hasPosition={options.hasPosition ?? true}
      phase={options.phase}
      {...handlers}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogue = { data: { zones: [zone(6)] } };
});

describe('sheet of an ordered circuit', () => {
  it('shows the name, the length, the loop, the source and the button', async () => {
    await show(loop);
    expect(screen.getByText('Circuit VTT balisé')).toBeTruthy();
    expect(screen.getByText('Petite Suisse Lorraine à VTT')).toBeTruthy();
    expect(screen.getByText('34,9 km · boucle')).toBeTruthy();
    expect(screen.getByText('Tracé du circuit : OpenStreetMap')).toBeTruthy();
    expect(
      screen.getByText(/Départ : le point du circuit le plus proche/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Faire un itinéraire du circuit Petite Suisse Lorraine à VTT',
      ),
    ).toBeTruthy();
  });

  it('says the start is the beginning when the position is unknown', async () => {
    await show(loop, { hasPosition: false });
    expect(
      screen.getByText(/le début du circuit, car votre position est inconnue/),
    ).toBeTruthy();
  });

  it('writes "aller simple" and the start at the beginning', async () => {
    await show(
      trailOf({
        osm_id: 2,
        ref: '7',
        ordered: LINE,
        loop: false,
        ordered_m: 18600,
        removed_m: 0,
      }),
    );
    expect(screen.getByText('Circuit 7')).toBeTruthy();
    expect(screen.getByText('18,6 km · aller simple')).toBeTruthy();
    expect(screen.getByText(/Départ : le début du circuit\./)).toBeTruthy();
  });

  it('says nothing about variants when none were removed', async () => {
    await show(loop);
    expect(screen.queryByText(/petites variantes/)).toBeNull();
  });

  it('says the small variants are not taken when some were removed', async () => {
    await show(
      trailOf({
        osm_id: 3,
        ordered: LINE,
        loop: true,
        ordered_m: 21326,
        removed_m: 1200,
      }),
    );
    expect(
      screen.getByText(
        /Les petites variantes du circuit ne sont pas reprises\./,
      ),
    ).toBeTruthy();
  });

  it('names a circuit without name nor number', async () => {
    await show(
      trailOf({
        osm_id: 4,
        ordered: LINE,
        loop: true,
        ordered_m: 1000,
        removed_m: 0,
      }),
    );
    expect(screen.getByText('Circuit sans nom')).toBeTruthy();
  });

  it('calls onMake from the button, onClose from the cross and the backdrop', async () => {
    await show(loop);
    await fireEvent.press(screen.getByTestId('trail-make'));
    expect(handlers.onMake).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('trail-close'));
    await fireEvent.press(
      screen.getByTestId('trail-backdrop', { includeHiddenElements: true }),
    );
    expect(handlers.onClose).toHaveBeenCalledTimes(2);
  });
});

describe('sheet of a refused circuit', () => {
  it.each(['parts', 'branches', 'removedTooMuch'])(
    'tells why there is no button (%s)',
    async (refusal) => {
      await show(
        trailOf({
          osm_id: 5,
          name: 'Tour du Bois',
          length_m: 22400,
          ordered: null,
          refusal,
        }),
      );
      expect(screen.getByText('Tour du Bois')).toBeTruthy();
      expect(screen.getByText('environ 22 km')).toBeTruthy();
      expect(
        screen.getByText(/Ce circuit ne peut pas devenir un itinéraire\./),
      ).toBeTruthy();
      expect(screen.queryByTestId('trail-make')).toBeNull();
      expect(screen.queryByTestId('trail-update')).toBeNull();
      expect(screen.getByText('Tracé du circuit : OpenStreetMap')).toBeTruthy();
    },
  );
});

describe('sheet of a circuit of an old zone', () => {
  const old = trailOf({ osm_id: 6, name: 'Ancien', length_m: 35040 });

  it('offers the update, with its size, and no itinerary button', async () => {
    await show(old);
    expect(screen.getByText('environ 35 km')).toBeTruthy();
    expect(screen.getByText(/Zone à mettre à jour\./)).toBeTruthy();
    expect(
      screen.getByText(/la nouvelle version de la zone Nancy et forêt de Haye/),
    ).toBeTruthy();
    expect(screen.getByText('Mettre à jour · 108 Mo')).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable pendant la mise à jour.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('trail-make')).toBeNull();
    await fireEvent.press(screen.getByTestId('trail-update'));
    expect(handlers.onUpdateZone).toHaveBeenCalledWith(zone(6));
  });

  it('offers "Voir les zones" without network', async () => {
    mockCatalogue = { isError: true };
    await show(old);
    expect(
      screen.getByText(/Sans réseau, RutaPulse ne peut pas la chercher\./),
    ).toBeTruthy();
    expect(screen.queryByTestId('trail-update')).toBeNull();
    await fireEvent.press(screen.getByTestId('trail-see-zones'));
    expect(handlers.onSeeZones).toHaveBeenCalledTimes(1);
  });

  it('says the update is running, with "Voir les zones"', async () => {
    await show(old, { phase: 'running' });
    expect(screen.getByText(/Mise à jour en cours\./)).toBeTruthy();
    expect(
      screen.getByText(/vous pourrez faire de ce circuit un itinéraire/),
    ).toBeTruthy();
    expect(screen.queryByTestId('trail-update')).toBeNull();
    await fireEvent.press(screen.getByTestId('trail-see-zones'));
    expect(handlers.onSeeZones).toHaveBeenCalledTimes(1);
  });

  it('also says it is offline when the catalogue waits for a network', async () => {
    mockCatalogue = { fetchStatus: 'paused' };
    await show(old);
    expect(screen.getByText(/Sans réseau/)).toBeTruthy();
  });

  it('does not claim to be offline during the first reading', async () => {
    mockCatalogue = { fetchStatus: 'fetching' };
    await show(old);
    expect(screen.getByText(/Zone à mettre à jour\./)).toBeTruthy();
    expect(screen.getByText(/la nouvelle version de la zone/)).toBeTruthy();
    expect(screen.queryByText(/Sans réseau/)).toBeNull();
    expect(screen.queryByTestId('trail-update')).toBeNull();
    expect(screen.queryByTestId('trail-see-zones')).toBeNull();
  });

  it('says the update failed, not "en cours", with "Voir les zones"', async () => {
    await show(old, { phase: 'failed' });
    expect(screen.getByText(/La mise à jour n'a pas abouti\./)).toBeTruthy();
    expect(screen.queryByText(/Mise à jour en cours/)).toBeNull();
    await fireEvent.press(screen.getByTestId('trail-see-zones'));
    expect(handlers.onSeeZones).toHaveBeenCalledTimes(1);
  });

  it('has no button when the catalogue has no newer version', async () => {
    mockCatalogue = { data: { zones: [zone(5)] } };
    await show(old);
    expect(
      screen.getByText(/Ce circuit ne peut pas encore devenir un itinéraire\./),
    ).toBeTruthy();
    expect(
      screen.getByText(/Une prochaine version de la zone le permettra\./),
    ).toBeTruthy();
    expect(screen.queryByTestId('trail-update')).toBeNull();
    expect(screen.queryByTestId('trail-see-zones')).toBeNull();
  });
});

describe('list of several circuits', () => {
  it('shows the count and one row per circuit, in the given order', async () => {
    const other = trailOf({
      osm_id: 9,
      name: 'Les Trois Vallées',
      ordered: LINE,
      loop: false,
      ordered_m: 18600,
      removed_m: 0,
    });
    const onChoose = jest.fn();
    await render(
      <TrailListSheet
        trails={[loop, other]}
        onChoose={onChoose}
        onClose={handlers.onClose}
      />,
    );
    expect(screen.getByText('2 circuits passent ici')).toBeTruthy();
    expect(
      screen.getByLabelText('Les Trois Vallées, 18,6 km · aller simple'),
    ).toBeTruthy();
    expect(screen.getByText('Circuits VTT balisés')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('trail-row-9'));
    expect(onChoose).toHaveBeenCalledWith(other);
    await fireEvent.press(screen.getByTestId('trail-close'));
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });
});
