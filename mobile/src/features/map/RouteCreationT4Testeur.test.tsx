import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RouteResult } from '@/core/routing/routeResponse';
import type { ReadyMarker } from '@/core/zones/zoneLayout';

import { MapScreen } from './MapScreen';

// MapLibre, the GPS, the disk and the engine are replaced.
let mockMapProps: Record<string, unknown> = {};
let mockInstalled: ReadyMarker[] | undefined;
const mockComputeRoute = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Map: (props: Record<string, unknown> & { children: ReactNode }) => {
      mockMapProps = props;
      return <View testID="map">{props.children}</View>;
    },
    Camera: () => null,
    Layer: () => null,
    UserLocation: () => null,
    GeoJSONSource: (props: { data: unknown }) => {
      return null;
    },
    Marker: (props: { children: ReactNode }) => <>{props.children}</>,
    useCurrentPosition: () => undefined,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve({ granted: false }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({ data: mockInstalled }),
}));
jest.mock('@/shared-data/zones/zoneFileUri', () => ({
  zoneFileUri: (zone: { id: string }, path: string) =>
    `file:///doc/zones/${zone.id}/${path}`,
}));
jest.mock('@/shared-data/routing/computeRoute', () => ({
  computeRoute: (...args: unknown[]) => mockComputeRoute(...args),
}));
jest.mock('./useGlyphsReady', () => ({
  useGlyphsReady: () => true,
  glyphsDirUri: () => 'file:///doc/glyphs/1',
}));

const nancy: ReadyMarker = {
  localFormat: 1,
  installedAt: '2026-10-25T10:00:00.000Z',
  zone: {
    id: 'nancy',
    name: 'Nancy',
    version: 3,
    bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
    osmDate: '2026-10-22T20:21:33Z',
    totalBytes: 1,
    files: [],
  },
};

const SUCCESS: RouteResult = {
  ok: true,
  shape: [
    [6.1015, 48.6612],
    [6.1408, 48.6846],
  ],
  distanceKm: 25.1,
  durationS: 95 * 60,
};

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <MapScreen />
    </QueryClientProvider>,
  );
  await act(async () => {});
}

// A touch on the map, as MapLibre reports it.
async function touchMap(lon: number, lat: number) {
  const onPress = mockMapProps.onPress as (e: unknown) => void;
  await act(async () => {
    onPress({ nativeEvent: { lngLat: [lon, lat], point: { x: 0, y: 0 } } });
  });
}

const HAYE: [number, number] = [6.1015, 48.6612];
const NANCY: [number, number] = [6.1408, 48.6846];

async function startRoute() {
  await fireEvent.press(screen.getByTestId('new-route-button'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled = [nancy];
  mockComputeRoute.mockResolvedValue(SUCCESS);
});

const KINDS = [
  'outOfZone',
  'noRoute',
  'engineUnavailable',
  'zoneUnreadable',
  'failed',
] as const;

describe('spec T4 : parcours', () => {
  it('bouton visible avec une zone, absent sans zone', async () => {
    await renderScreen();
    expect(screen.getByTestId('new-route-button')).toBeTruthy();
    await screen.unmount();
    mockInstalled = [];
    await renderScreen();
    expect(screen.queryByTestId('new-route-button')).toBeNull();
  });

  it('parcours complet : titre, appel dans l ordre, résumé de la maquette, sortie', async () => {
    await renderScreen();
    await startRoute();
    expect(screen.getByText('Nouvel itinéraire')).toBeTruthy();
    expect(screen.getByTestId('route-hint')).toBeTruthy();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    expect(mockComputeRoute).toHaveBeenCalledTimes(1);
    expect(mockComputeRoute).toHaveBeenCalledWith([
      { lon: HAYE[0], lat: HAYE[1] },
      { lon: NANCY[0], lat: NANCY[1] },
    ]);
    // Maquette 10 : « 25,1 km » et « 1 h 35 ».
    expect(screen.getByTestId('route-distance')).toHaveTextContent('25,1 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('1 h 35');
    expect(screen.getByTestId('route-start')).toBeTruthy();
    expect(screen.getByTestId('route-end')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('route-close'));
    expect(screen.queryByTestId('route-summary')).toBeNull();
    expect(screen.queryByTestId('route-close')).toBeNull();
    expect(screen.getByTestId('new-route-button')).toBeTruthy();
  });

  it('pendant le calcul : indicateur visible', async () => {
    mockComputeRoute.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    expect(screen.getByTestId('route-computing')).toBeTruthy();
    expect(screen.queryByTestId('route-summary')).toBeNull();
  });

  it('hors périmètre absent', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    for (const word of ['Enregistrer', 'Boucler', 'Annuler', 'D+']) {
      expect(
        screen.queryByText(new RegExp(word.replace('+', '\\+'))),
      ).toBeNull();
    }
  });
});

describe('spec C6 : erreurs', () => {
  it('messages français non vides, distincts, avec une sortie', async () => {
    const titles: string[] = [];
    const texts: string[] = [];
    for (const kind of KINDS) {
      mockComputeRoute.mockResolvedValue({ ok: false, error: kind });
      await renderScreen();
      await startRoute();
      await touchMap(...HAYE);
      await touchMap(...NANCY);
      const sheet = screen.getByTestId('route-error');
      const strings: string[] = [];
      const collect = (node: unknown) => {
        const n = node as {
          type?: unknown;
          children?: unknown[];
          props?: { children?: unknown };
        };
        if (typeof node === 'string') strings.push(node);
        else if (n && Array.isArray(n.children)) n.children.forEach(collect);
      };
      collect(sheet.children.length ? sheet : null);
      const visible = strings.filter((s) => s.trim().length > 0);
      expect(visible.length).toBeGreaterThanOrEqual(3); // title, text, button
      titles.push(visible[0]);
      texts.push(visible[1]);
      expect(screen.getByTestId('route-error-remove')).toBeTruthy();
      await screen.unmount();
    }
    expect(new Set(titles).size).toBe(KINDS.length);
    expect(new Set(texts).size).toBe(KINDS.length);
    for (const s of [...titles, ...texts]) {
      expect(s.length).toBeGreaterThan(5);
      expect(s).not.toMatch(/^route\./); // no raw key
    }
  });

  it('point hors rectangle : message, computeRoute non appelé', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(2.35, 48.85);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('arrivée hors rectangle après un départ valide : pas d appel', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(7.5, 48.6);
    expect(screen.getByText('Point hors de votre zone')).toBeTruthy();
    expect(mockComputeRoute).not.toHaveBeenCalled();
  });

  it('Retirer ce point : on peut toucher à nouveau et calculer', async () => {
    await renderScreen();
    await startRoute();
    await touchMap(2.35, 48.85);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    expect(screen.queryByTestId('route-error')).toBeNull();
    await touchMap(...HAYE);
    expect(screen.getByTestId('route-start')).toBeTruthy();
    await touchMap(...NANCY);
    expect(screen.getByTestId('route-summary')).toBeTruthy();
  });

  it('après une erreur du moteur, Retirer ce point permet un nouvel essai', async () => {
    mockComputeRoute.mockResolvedValueOnce({ ok: false, error: 'noRoute' });
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    await fireEvent.press(screen.getByTestId('route-error-remove'));
    await touchMap(...NANCY);
    expect(mockComputeRoute).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('route-summary')).toBeTruthy();
  });

  it('computeRoute qui rejette : l écran ne plante pas', async () => {
    mockComputeRoute.mockRejectedValue(new Error('boom'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    process.off('unhandledRejection', onUnhandled);
    spy.mockRestore();
    // Screen still mounted, not stuck on "computing", and a way out exists.
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.queryByTestId('route-computing')).toBeNull();
    expect(unhandled).toEqual([]);
    expect(screen.getByTestId('route-close')).toBeTruthy();
  });
});

describe('spec : réponse lente puis arrivée changée', () => {
  it('seule la dernière réponse s affiche', async () => {
    let resolveFirst: (r: RouteResult) => void = () => {};
    mockComputeRoute
      .mockImplementationOnce(
        () => new Promise<RouteResult>((r) => (resolveFirst = r)),
      )
      .mockResolvedValueOnce({ ...SUCCESS, distanceKm: 7.5, durationS: 1200 });
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    await touchMap(6.2, 48.7);
    expect(screen.getByTestId('route-distance')).toHaveTextContent('7,5 km');
    await act(async () => {
      resolveFirst({ ...SUCCESS, distanceKm: 99, durationS: 99999 });
    });
    expect(screen.getByTestId('route-distance')).toHaveTextContent('7,5 km');
    expect(screen.getByTestId('route-duration')).toHaveTextContent('20 min');
  });

  it('réponse lente en erreur ignorée si une autre est arrivée', async () => {
    let rejectFirst: (r: RouteResult) => void = () => {};
    mockComputeRoute
      .mockImplementationOnce(
        () => new Promise<RouteResult>((r) => (rejectFirst = r)),
      )
      .mockResolvedValueOnce(SUCCESS);
    await renderScreen();
    await startRoute();
    await touchMap(...HAYE);
    await touchMap(...NANCY);
    await touchMap(6.2, 48.7);
    await act(async () => {
      rejectFirst({ ok: false, error: 'noRoute' });
    });
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.getByTestId('route-summary')).toBeTruthy();
  });
});
