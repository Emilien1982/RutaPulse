// The Itinéraires tab (ADR 0019, sections 6, 10 and 13; spec C4, C5, C8,
// C13). The database is a real SQLite in memory; the router, the safe area
// and the zones are faked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { encodePolyline6 } from '@/core/routing/routeResponse';
import {
  MIGRATIONS,
  migrate,
  RoutesTooNewError,
} from '@/core/routes/migrations';
import { insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';

import { RoutesScreen } from './RoutesScreen';

const mockPush = jest.fn();
let mockDb: Promise<unknown>;
let mockInService: { id: string } | null | undefined;
let mockInstalled: { id: string }[];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
// The import is made in T6: here the picker is cancelled.
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: () => Promise.resolve({ canceled: true, assets: null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneInService: () => mockInService,
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({
    data: mockInstalled.map((zone) => ({ zone, installedAt: '2026-11-01' })),
  }),
}));

const YEAR = new Date().getFullYear();
const day = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).getTime();
const NANCY = { id: 'nancy', version: 5, name: 'Nancy' };

let db: NodeSqlDb;
let alert: jest.SpyInstance;
const originalOs = Platform.OS;
const setOs = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function open() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <RoutesScreen />
    </QueryClientProvider>,
  );
  await settle();
}

const rowLabels = () =>
  screen
    .getAllByTestId(/^route-row-\d+$/)
    .map((row) => String(row.props.accessibilityLabel).split(',')[0]);

// The last dialog opened by `Alert.alert`.
const lastAlert = () => {
  const [title, message, buttons] = alert.mock.calls.at(-1)!;
  return { title, message, buttons } as {
    title: string;
    message?: string;
    buttons: { text: string; style?: string; onPress?: () => void }[];
  };
};
async function press(button: { onPress?: () => void } | undefined) {
  await act(async () => button?.onPress?.());
  await settle();
}

beforeEach(async () => {
  jest.clearAllMocks();
  setOs('android');
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
  mockInService = { id: 'nancy' };
  mockInstalled = [{ id: 'nancy' }];
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  setOs(originalOs as 'ios' | 'android');
  jest.restoreAllMocks();
  db.close();
});

describe('the list', () => {
  it('shows the most recent first, by last save or import', async () => {
    await insertRoute(db, sampleCreated({ name: 'Ancien', savedAt: 1_000 }));
    await insertRoute(db, sampleCreated({ name: 'Récent', savedAt: 3_000 }));
    await insertRoute(db, sampleGpx({ name: 'Milieu', savedAt: 2_000 }));
    await open();
    expect(rowLabels()).toEqual(['Récent', 'Milieu', 'Ancien']);
  });

  it('shows medallion, name, figures, zone and origin of each line', async () => {
    await insertRoute(
      db,
      sampleCreated({
        name: 'Itinéraire du 3 nov.',
        createdAt: day(YEAR, 11, 3),
        savedAt: day(YEAR, 11, 3),
        distanceKm: 25.1,
        durationS: 5700,
        ascentM: 421,
        preview: encodePolyline6([
          [6.1, 48.6],
          [6.2, 48.7],
        ]),
      }),
    );
    await open();
    expect(screen.getByText('Itinéraire du 3 nov.')).toBeTruthy();
    expect(screen.getByText('25,1 km')).toBeTruthy();
    expect(screen.getByText(/D\+ 421\s+m · 1\s+h\s+35/)).toBeTruthy();
    expect(screen.getByText('Zone Nancy · créé le 3 nov.')).toBeTruthy();
    expect(
      screen.getByLabelText('Actions de Itinéraire du 3 nov.'),
    ).toBeTruthy();
    expect(screen.getByText('Mes itinéraires')).toBeTruthy();
  });

  it('says created, modified and imported, with the year when it is not this one', async () => {
    await insertRoute(
      db,
      sampleCreated({
        name: 'A',
        createdAt: day(YEAR, 10, 12),
        savedAt: day(YEAR, 10, 28),
      }),
    );
    await insertRoute(
      db,
      sampleGpx({
        name: 'B',
        zone: NANCY,
        createdAt: day(YEAR - 1, 10, 19),
        savedAt: day(YEAR - 1, 10, 19),
      }),
    );
    await open();
    expect(screen.getByText('Zone Nancy · modifié le 28 oct.')).toBeTruthy();
    expect(
      screen.getByText(`Zone Nancy · GPX importé le 19 oct. ${YEAR - 1}`),
    ).toBeTruthy();
  });

  it('shows a dash for a D+ never known', async () => {
    await insertRoute(db, sampleCreated({ ascentM: null, descentM: null }));
    await open();
    expect(screen.getByText(/D\+ —/)).toBeTruthy();
  });

  it('opens the route when a line is touched', async () => {
    await insertRoute(db, sampleCreated({ name: 'Une' }));
    await open();
    await fireEvent.press(screen.getByTestId('route-row-1'));
    expect(mockPush).toHaveBeenCalledWith('/route/1');
  });

  it('draws the "Importer un GPX" button, which does nothing when the picker is cancelled', async () => {
    await insertRoute(db, sampleCreated());
    await open();
    expect(screen.getByText('Importer un GPX')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Importer un fichier GPX'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('renders 50 lines fast (indicative: the release measure is in T7)', async () => {
    for (let i = 0; i < 50; i++) {
      await insertRoute(
        db,
        sampleCreated({
          name: `Itinéraire ${i}`,
          savedAt: 1_000 + i,
          preview: encodePolyline6(
            Array.from({ length: 66 }, (_, k): [number, number] => [
              6.1 + k * 0.001,
              48.6 + Math.sin(k / 5) * 0.01,
            ]),
          ),
        }),
      );
    }
    const start = performance.now();
    await open();
    const elapsed = performance.now() - start;
    expect(screen.getAllByTestId(/^route-row-\d+$/)).toHaveLength(50);
    // `open` waits 30 ms for the queries to settle; the rest is the render.
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('the empty list', () => {
  it('explains how to get a first route, and creates one', async () => {
    await open();
    expect(screen.getByText("Pas encore d'itinéraire")).toBeTruthy();
    expect(
      screen.getByText(
        'Tracez une sortie sur la carte, puis touchez « Enregistrer ». Vous pouvez aussi importer un fichier GPX.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Importer un GPX')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('routes-create'));
    expect(mockPush).toHaveBeenCalledWith('/draft');
  });

  it('comes back after the last route is deleted', async () => {
    await insertRoute(db, sampleCreated({ name: 'Seule' }));
    await open();
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    await press(lastAlert().buttons[0]);
    await press(lastAlert().buttons[1]);
    expect(screen.getByTestId('routes-empty')).toBeTruthy();
  });
});

describe('a zone that is absent (C8)', () => {
  it('keeps the line, with the problem in place of the origin', async () => {
    mockInstalled = [{ id: 'nancy' }];
    await insertRoute(
      db,
      sampleCreated({
        name: 'Longemer',
        savedAt: 3_000,
        zone: { id: 'gerardmer', version: 2, name: 'Gérardmer' },
      }),
    );
    await insertRoute(
      db,
      sampleGpx({ name: 'Metz – Gorze', savedAt: 2_000, zone: null }),
    );
    await insertRoute(db, sampleCreated({ name: 'Nancy', savedAt: 1_000 }));
    await open();
    expect(screen.getByText('Zone Gérardmer supprimée')).toBeTruthy();
    expect(screen.getByText('Hors de vos zones')).toBeTruthy();
    expect(screen.getByText(/Zone Nancy · créé le/)).toBeTruthy();
    expect(
      screen.getByTestId('route-row-1').props.accessibilityLabel,
    ).toContain('Zone Gérardmer supprimée');
    expect(
      screen.getByTestId('route-row-2').props.accessibilityLabel,
    ).toContain('Hors de vos zones');
  });

  it('still renames, exports and deletes such a line', async () => {
    await insertRoute(
      db,
      sampleCreated({
        zone: { id: 'gerardmer', version: 2, name: 'Gérardmer' },
      }),
    );
    await open();
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    expect(lastAlert().buttons.map((b) => b.text)).toEqual([
      'Supprimer',
      'Exporter en GPX',
      'Renommer',
    ]);
    await press(lastAlert().buttons[2]);
    await fireEvent.changeText(screen.getByTestId('rename-input'), 'Autre');
    await fireEvent.press(screen.getByTestId('rename-submit'));
    await settle();
    expect(screen.getByText('Autre')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    await press(lastAlert().buttons[0]);
    await press(lastAlert().buttons[1]);
    expect(await listRoutes(db)).toHaveLength(0);
  });
});

describe('a database that is too recent', () => {
  it('says so, without crashing', async () => {
    mockDb = Promise.reject(new RoutesTooNewError());
    mockDb.catch(() => undefined);
    await open();
    expect(screen.getByText('Itinéraires indisponibles')).toBeTruthy();
    expect(
      screen.getByText(
        'Mettez à jour RutaPulse pour retrouver vos itinéraires.',
      ),
    ).toBeTruthy();
  });
});

describe('the menu', () => {
  beforeEach(async () => {
    await insertRoute(db, sampleCreated({ name: 'Une', savedAt: 1_000 }));
  });

  it('opens a dialog with three actions on Android, from "⋮" or a long press', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(lastAlert().title).toBe('Une');
    expect(lastAlert().buttons).toHaveLength(3);
    await fireEvent(screen.getByTestId('route-row-1'), 'longPress');
    expect(alert).toHaveBeenCalledTimes(2);
    expect(lastAlert().buttons.map((b) => b.text)).toEqual([
      'Supprimer',
      'Exporter en GPX',
      'Renommer',
    ]);
  });

  it('opens an action sheet on iOS, and renames from it', async () => {
    setOs('ios');
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => undefined);
    await open();
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    expect(alert).not.toHaveBeenCalled();
    expect(sheet.mock.calls[0]![0].options).toEqual([
      'Renommer',
      'Exporter en GPX',
      'Supprimer',
      'Annuler',
    ]);
    await act(async () => sheet.mock.calls[0]![1](0));
    expect(screen.getByTestId('rename-input')).toBeTruthy();
  });

  it('does nothing for "Exporter en GPX" yet (T6)', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('route-menu-1'));
    await press(lastAlert().buttons[1]);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('rename-input')).toBeNull();
    expect(await listRoutes(db)).toHaveLength(1);
  });
});

describe('rename (mockup 40, state 4)', () => {
  beforeEach(async () => {
    await insertRoute(db, sampleCreated({ name: 'Ancien', savedAt: 1_000 }));
    await insertRoute(db, sampleCreated({ name: 'Milieu', savedAt: 2_000 }));
    await insertRoute(db, sampleCreated({ name: 'Récent', savedAt: 3_000 }));
  });

  async function openSheet(id: number) {
    await open();
    await fireEvent.press(screen.getByTestId(`route-menu-${id}`));
    await press(lastAlert().buttons[2]);
  }
  const input = () => screen.getByTestId('rename-input');
  const submit = () => screen.getByTestId('rename-submit');

  it('opens with the current name, all selected, and its count', async () => {
    await openSheet(2);
    expect(screen.getByText("Renommer l'itinéraire")).toBeTruthy();
    expect(input().props.value).toBe('Milieu');
    expect(input().props.selectTextOnFocus).toBe(true);
    expect(input().props.autoFocus).toBe(true);
    expect(screen.getByTestId('rename-count')).toHaveTextContent('6 / 60');
  });

  it('renames at once and keeps the order', async () => {
    await openSheet(2);
    await fireEvent.changeText(input(), '  Boucle   du bois ');
    await fireEvent.press(submit());
    await settle();
    expect(rowLabels()).toEqual(['Récent', 'Boucle du bois', 'Ancien']);
    expect(screen.queryByTestId('rename-input')).toBeNull();
    const saved = await listRoutes(db);
    expect(saved.map((r) => r.savedAt)).toEqual([3_000, 2_000, 1_000]);
  });

  it('says so and turns the button off when the name is empty', async () => {
    await openSheet(2);
    await fireEvent.changeText(input(), '   ');
    expect(screen.getByText("Donnez un nom à l'itinéraire.")).toBeTruthy();
    expect(submit().props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(submit());
    await settle();
    expect(rowLabels()).toContain('Milieu');
    await fireEvent.changeText(input(), 'Ok');
    expect(screen.queryByText("Donnez un nom à l'itinéraire.")).toBeNull();
    expect(submit().props.accessibilityState).toEqual({ disabled: false });
  });

  it('clears the field with the cross', async () => {
    await openSheet(2);
    await fireEvent.press(screen.getByLabelText('Effacer le nom'));
    expect(input().props.value).toBe('');
    expect(screen.getByTestId('rename-count')).toHaveTextContent('0 / 60');
  });

  it('accepts 60 characters, and cuts a 61st', async () => {
    await openSheet(2);
    await fireEvent.changeText(input(), 'a'.repeat(60));
    expect(screen.getByTestId('rename-count')).toHaveTextContent('60 / 60');
    expect(screen.getByText('60 caractères au plus.')).toBeTruthy();
    await fireEvent.changeText(input(), 'a'.repeat(61));
    expect(input().props.value).toBe('a'.repeat(60));
    expect(screen.getByTestId('rename-count')).toHaveTextContent('60 / 60');
    await fireEvent.press(submit());
    await settle();
    const names = (await listRoutes(db)).map((r) => r.name);
    expect(names).toContain('a'.repeat(60));
  });

  it('counts an emoji as one character', async () => {
    await openSheet(2);
    await fireEvent.changeText(input(), `${'a'.repeat(59)}🚵`);
    expect(screen.getByTestId('rename-count')).toHaveTextContent('60 / 60');
    expect(input().props.value).toBe(`${'a'.repeat(59)}🚵`);
  });

  it('counts the name as it will be kept', async () => {
    await openSheet(2);
    await fireEvent.changeText(input(), '  a   b  ');
    expect(screen.getByTestId('rename-count')).toHaveTextContent('3 / 60');
  });

  it('keeps the name when cancelled', async () => {
    await openSheet(2);
    await fireEvent.changeText(input(), 'Autre');
    await fireEvent.press(screen.getByTestId('rename-cancel'));
    expect(screen.queryByTestId('rename-input')).toBeNull();
    expect(rowLabels()).toEqual(['Récent', 'Milieu', 'Ancien']);
  });
});

describe('delete (mockup 40, state 5)', () => {
  beforeEach(async () => {
    await insertRoute(db, sampleCreated({ name: 'Ancien', savedAt: 1_000 }));
    await insertRoute(db, sampleCreated({ name: 'Récent', savedAt: 3_000 }));
  });

  async function askDelete(id: number) {
    await open();
    await fireEvent.press(screen.getByTestId(`route-menu-${id}`));
    await press(lastAlert().buttons[0]);
  }

  it('asks first, with the texts of the mockup', async () => {
    await askDelete(1);
    const { title, message, buttons } = lastAlert();
    expect(title).toBe('Supprimer «\u00A0Ancien\u00A0»\u202F?');
    expect(message).toBe(
      "L'itinéraire sera effacé du téléphone. Pour le garder ailleurs, exportez-le d'abord en GPX.",
    );
    expect(buttons.map((b) => b.text)).toEqual(['Garder', 'Supprimer']);
    expect(buttons[0]!.style).toBe('cancel');
    expect(buttons[1]!.style).toBe('destructive');
    expect(await listRoutes(db)).toHaveLength(2);
  });

  it('keeps the route when the answer is "Garder"', async () => {
    await askDelete(1);
    await press(lastAlert().buttons[0]);
    expect(rowLabels()).toEqual(['Récent', 'Ancien']);
    expect(await listRoutes(db)).toHaveLength(2);
  });

  it('removes the route and updates the list at once', async () => {
    await askDelete(1);
    await press(lastAlert().buttons[1]);
    expect(rowLabels()).toEqual(['Récent']);
    expect((await listRoutes(db)).map((r) => r.name)).toEqual(['Récent']);
  });
});
