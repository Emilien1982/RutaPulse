// Tests du testeur, T5 : l'onglet Itinéraires, écrits d'après la spec
// (C4, C5, C8, C13), l'ADR 0019 (§ 6, 10, 11, 13, réponses 1 à 4) et la
// maquette design/v1/40-mes-itineraires.html (états 1, 2, 3, 4, 5, 7a).
// Base SQLite réelle en mémoire ; routeur, zones et marges faux.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import {
  MIGRATIONS,
  migrate,
  RoutesTooNewError,
} from '@/core/routes/migrations';
import { encodePolyline6 } from '@/core/routing/routeResponse';
import { insertRoute, listRoutes } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated, sampleGpx } from '@/core/routes/testing/sampleRoutes';

import { menuEntry, menuTexts } from '@/ui/testing/androidMenu';

import { RoutesScreen } from './RoutesScreen';

const mockPush = jest.fn();
let mockDb: Promise<unknown>;
let mockInService: { id: string } | null | undefined;
let mockInstalled: { id: string }[];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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
const noon = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).getTime();
const NANCY = { id: 'nancy', version: 5, name: 'Nancy' };

let db: NodeSqlDb;
let alert: jest.SpyInstance;
const originalOs = Platform.OS;
const setOs = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

// Espaces insécables et fines remplacés par une espace : on teste les mots.
const flat = (s: unknown) => String(s).replace(/[\s  ]+/g, ' ');

async function settle() {
  for (let i = 0; i < 8; i++) {
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
const names = () =>
  screen
    .getAllByTestId(/^route-row-\d+$/)
    .map((row) => flat(row.props.accessibilityLabel).split(',')[0]);
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

describe('C5 : tri et lignes (maquette 40, état 1)', () => {
  it("met en haut le dernier enregistrement ou import, quelle que soit l'origine", async () => {
    await insertRoute(db, sampleCreated({ name: 'A', savedAt: 100 }));
    await insertRoute(db, sampleGpx({ name: 'B', savedAt: 300 }));
    await insertRoute(db, sampleCreated({ name: 'C', savedAt: 200 }));
    await open();
    expect(names()).toEqual(['B', 'C', 'A']);
  });

  it('montre la ligne de la maquette : 25,1 km · D+ 421 m · 1 h 35, Zone Nancy · créé le 3 nov.', async () => {
    await insertRoute(
      db,
      sampleCreated({
        name: 'Itinéraire du 3 nov.',
        createdAt: noon(YEAR, 11, 3),
        savedAt: noon(YEAR, 11, 3),
        distanceKm: 25.1,
        ascentM: 421,
        durationS: 95 * 60,
      }),
    );
    await open();
    const label = flat(
      screen.getByTestId('route-row-1').props.accessibilityLabel,
    );
    // Maquette 40 : « {nom}, {distance}, montée {montée}, {durée}, {zone et origine} »
    expect(label).toBe(
      'Itinéraire du 3 nov., 25,1 km, montée 421 m, 1 h 35, Zone Nancy · créé le 3 nov.',
    );
    expect(screen.getByText('Itinéraire du 3 nov.')).toBeTruthy();
    expect(flat(screen.getByText(/D\+ 421/).props.children.join(''))).toContain(
      'D+ 421 m · 1 h 35',
    );
  });

  it('dit « modifié le » après une nouvelle sauvegarde et « GPX importé le » pour un import', async () => {
    await insertRoute(
      db,
      sampleCreated({
        name: 'Haye',
        createdAt: noon(YEAR, 10, 5),
        savedAt: noon(YEAR, 10, 28),
        distanceKm: 31.4,
        ascentM: 512,
        durationS: 125 * 60,
      }),
    );
    await insertRoute(
      db,
      sampleGpx({
        name: 'Ludres',
        zone: NANCY,
        createdAt: noon(YEAR, 10, 19),
        savedAt: noon(YEAR, 10, 19),
        distanceKm: 42.1,
        ascentM: 665,
        durationS: 160 * 60,
      }),
    );
    await open();
    expect(screen.getByText('Zone Nancy · modifié le 28 oct.')).toBeTruthy();
    expect(
      screen.getByText('Zone Nancy · GPX importé le 19 oct.'),
    ).toBeTruthy();
    expect(
      flat(screen.getByTestId('route-row-1').props.accessibilityLabel),
    ).toContain('31,4 km, montée 512 m, 2 h 05');
    expect(
      flat(screen.getByTestId('route-row-2').props.accessibilityLabel),
    ).toContain('42,1 km, montée 665 m, 2 h 40');
  });

  it("ajoute l'année quand la date est d'une autre année, pas sinon", async () => {
    await insertRoute(
      db,
      sampleCreated({
        name: 'Vieux',
        createdAt: noon(YEAR - 1, 3, 3),
        savedAt: noon(YEAR - 1, 3, 3),
      }),
    );
    await insertRoute(
      db,
      sampleCreated({
        name: 'Neuf',
        createdAt: noon(YEAR, 3, 3),
        savedAt: noon(YEAR, 3, 3),
      }),
    );
    await open();
    expect(
      screen.getByText(`Zone Nancy · créé le 3 mars ${YEAR - 1}`),
    ).toBeTruthy();
    expect(screen.getByText('Zone Nancy · créé le 3 mars')).toBeTruthy();
  });

  it('affiche « — » pour un D+ jamais connu et une durée inférieure à une heure en minutes', async () => {
    await insertRoute(
      db,
      sampleCreated({ ascentM: null, descentM: null, durationS: 55 * 60 }),
    );
    await open();
    const label = flat(
      screen.getByTestId('route-row-1').props.accessibilityLabel,
    );
    expect(label).toContain('55 min');
    expect(screen.getByText(/D\+ —/)).toBeTruthy();
  });

  it('ouvre /route/[id] en touchant une ligne', async () => {
    await insertRoute(db, sampleCreated({ name: 'Un' }));
    await insertRoute(db, sampleCreated({ name: 'Deux', savedAt: 5_000 }));
    await open();
    await fireEvent.press(screen.getByTestId('route-row-2'));
    expect(mockPush).toHaveBeenCalledWith('/route/2');
    await fireEvent.press(screen.getByTestId('route-row-1'));
    expect(mockPush).toHaveBeenLastCalledWith('/route/1');
  });

  it('ne plante pas avec un nom très long ni une aperçu illisible', async () => {
    await insertRoute(
      db,
      sampleCreated({ name: 'x'.repeat(60), preview: '!!!\u0000' }),
    );
    await open();
    expect(screen.getAllByTestId(/^route-row-\d+$/)).toHaveLength(1);
  });
});

describe('liste vide (maquette 40, état 2)', () => {
  it('affiche les textes exacts de la maquette', async () => {
    await open();
    expect(screen.getByText("Pas encore d'itinéraire")).toBeTruthy();
    expect(
      screen.getByText(
        'Tracez une sortie sur la carte, puis touchez « Enregistrer ». Vous pouvez aussi importer un fichier GPX.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Créer un itinéraire')).toBeTruthy();
    expect(screen.getByText('Importer un GPX')).toBeTruthy();
    expect(screen.getByText('Mes itinéraires')).toBeTruthy();
  });

  it('« Créer un itinéraire » ouvre la création', async () => {
    await open();
    await fireEvent.press(screen.getByText('Créer un itinéraire'));
    expect(mockPush).toHaveBeenCalledWith('/draft');
  });

  it('revient à la liste vide après la suppression du dernier itinéraire', async () => {
    await insertRoute(db, sampleCreated({ name: 'Seul' }));
    await open();
    await fireEvent.press(screen.getByLabelText('Actions de Seul'));
    await press(menuEntry('delete'));
    await press(lastAlert().buttons[1]);
    expect(screen.getByText("Pas encore d'itinéraire")).toBeTruthy();
    expect(screen.queryByTestId(/^route-row-/)).toBeNull();
    expect(await listRoutes(db)).toHaveLength(0);
  });
});

describe('menu (maquette 40, état 3 ; réponse 4)', () => {
  beforeEach(async () => {
    await insertRoute(db, sampleCreated({ name: 'Une' }));
  });

  it('Android : « ⋮ » et appui long ouvrent la même feuille à 4 actions', async () => {
    await open();
    const expected = ['Renommer', 'Dupliquer', 'Exporter en GPX', 'Supprimer'];
    await fireEvent.press(screen.getByLabelText('Actions de Une'));
    expect(menuTexts()).toEqual(expected);
    await fireEvent.press(screen.getByTestId('menu-cancel'));
    await fireEvent(screen.getByTestId('route-row-1'), 'longPress');
    expect(menuTexts()).toEqual(expected);
    expect(alert).not.toHaveBeenCalled();
  });

  it('iOS : « ⋮ » et appui long ouvrent le même ActionSheetIOS, Supprimer en rouge', async () => {
    setOs('ios');
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => undefined);
    await open();
    await fireEvent.press(screen.getByLabelText('Actions de Une'));
    await fireEvent(screen.getByTestId('route-row-1'), 'longPress');
    expect(alert).not.toHaveBeenCalled();
    expect(sheet).toHaveBeenCalledTimes(2);
    const [a, b] = sheet.mock.calls.map((c) => c[0]);
    expect(a).toEqual(b);
    expect(a!.options.slice(0, 4)).toEqual([
      'Renommer',
      'Dupliquer',
      'Exporter en GPX',
      'Supprimer',
    ]);
    expect(a!.destructiveButtonIndex).toBe(3);
    expect(a!.cancelButtonIndex).toBe(a!.options.length - 1);
  });

  it('iOS : choisir Supprimer ouvre la confirmation', async () => {
    setOs('ios');
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => undefined);
    await open();
    await fireEvent.press(screen.getByLabelText('Actions de Une'));
    await act(async () => sheet.mock.calls[0]![1](3));
    expect(lastAlert().title).toContain('Supprimer');
  });

  it('pas de balayage : la ligne ne porte aucun geste de balayage', async () => {
    await open();
    const row = screen.getByTestId('route-row-1');
    expect(row.props.onSwipe).toBeUndefined();
    expect(screen.queryByText('Archiver')).toBeNull();
  });
});

describe('renommer (maquette 40, état 4)', () => {
  beforeEach(async () => {
    await insertRoute(db, sampleCreated({ name: 'Ancien', savedAt: 100 }));
    await insertRoute(db, sampleCreated({ name: 'Milieu', savedAt: 200 }));
    await insertRoute(db, sampleCreated({ name: 'Récent', savedAt: 300 }));
  });
  async function openSheet(label: string) {
    await open();
    await fireEvent.press(screen.getByLabelText(`Actions de ${label}`));
    await press(menuEntry('rename'));
  }
  const input = () => screen.getByLabelText("Nom de l'itinéraire");

  it('montre les textes de la maquette et le nom actuel avec son compteur', async () => {
    await openSheet('Milieu');
    expect(screen.getByText("Renommer l'itinéraire")).toBeTruthy();
    expect(screen.getByText("Nom de l'itinéraire")).toBeTruthy();
    expect(input().props.value).toBe('Milieu');
    expect(screen.getByText('6 / 60')).toBeTruthy();
    expect(screen.getByText('Annuler')).toBeTruthy();
    expect(screen.getByText('Renommer')).toBeTruthy();
    expect(screen.getByLabelText('Effacer le nom')).toBeTruthy();
  });

  it("refuse un nom vide ou fait d'espaces : message, bouton inactif, rien d'écrit", async () => {
    await openSheet('Milieu');
    for (const v of ['', '   ', ' \n\t ']) {
      await fireEvent.changeText(input(), v);
      expect(screen.getByText("Donnez un nom à l'itinéraire.")).toBeTruthy();
      const btn = screen.getByRole('button', { name: 'Renommer' });
      expect(btn.props.accessibilityState).toEqual({ disabled: true });
      await fireEvent.press(btn);
    }
    await settle();
    expect((await listRoutes(db)).map((r) => r.name).sort()).toEqual([
      'Ancien',
      'Milieu',
      'Récent',
    ]);
  });

  it('accepte 60 caractères, en coupe un 61e collé, et affiche « 60 caractères au plus. »', async () => {
    await openSheet('Milieu');
    await fireEvent.changeText(input(), 'b'.repeat(60));
    expect(screen.getByText('60 / 60')).toBeTruthy();
    expect(screen.getByText('60 caractères au plus.')).toBeTruthy();
    await fireEvent.changeText(input(), 'b'.repeat(61));
    expect(input().props.value).toHaveLength(60);
    await fireEvent.press(screen.getByRole('button', { name: 'Renommer' }));
    await settle();
    expect((await listRoutes(db)).map((r) => r.name)).toContain('b'.repeat(60));
  });

  it('garde les accents et les émojis, et compte un émoji pour un caractère', async () => {
    await openSheet('Milieu');
    await fireEvent.changeText(input(), "Étang d'été 🚵‍♂️🌲");
    await fireEvent.press(screen.getByRole('button', { name: 'Renommer' }));
    await settle();
    expect(screen.getByText("Étang d'été 🚵‍♂️🌲")).toBeTruthy();
    expect((await listRoutes(db)).map((r) => r.name)).toContain(
      "Étang d'été 🚵‍♂️🌲",
    );
  });

  it("met la liste à jour aussitôt sans changer l'ordre ni la date", async () => {
    await openSheet('Ancien');
    await fireEvent.changeText(input(), 'Tout neuf');
    await fireEvent.press(screen.getByRole('button', { name: 'Renommer' }));
    await settle();
    expect(names()).toEqual(['Récent', 'Milieu', 'Tout neuf']);
    expect((await listRoutes(db)).map((r) => r.savedAt)).toEqual([
      300, 200, 100,
    ]);
    expect(screen.queryByText("Renommer l'itinéraire")).toBeNull();
  });

  it('Annuler ne change rien', async () => {
    await openSheet('Milieu');
    await fireEvent.changeText(input(), 'Autre');
    await fireEvent.press(screen.getByText('Annuler'));
    expect(names()).toEqual(['Récent', 'Milieu', 'Ancien']);
  });
});

describe('supprimer (maquette 40, état 5)', () => {
  beforeEach(async () => {
    await insertRoute(
      db,
      sampleCreated({ name: 'Boucle du Bois de la Côte', savedAt: 200 }),
    );
    await insertRoute(db, sampleCreated({ name: 'Haye', savedAt: 100 }));
  });
  async function ask(label: string) {
    await open();
    await fireEvent.press(screen.getByLabelText(`Actions de ${label}`));
    await press(menuEntry('delete'));
  }

  it("demande d'abord, avec les textes de la maquette", async () => {
    await ask('Boucle du Bois de la Côte');
    const { title, message, buttons } = lastAlert();
    // Maquette : « Supprimer « Boucle du Bois de la Côte » ? » (espaces insécables)
    expect(flat(title)).toBe('Supprimer « Boucle du Bois de la Côte » ?');
    expect(message).toBe(
      "L'itinéraire sera effacé du téléphone. Pour le garder ailleurs, exportez-le d'abord en GPX.",
    );
    expect(buttons.map((b) => b.text)).toEqual(['Garder', 'Supprimer']);
    expect(buttons[0]!.style).toBe('cancel');
    expect(buttons[1]!.style).toBe('destructive');
    expect(await listRoutes(db)).toHaveLength(2);
  });

  it('« Garder » ne supprime rien', async () => {
    await ask('Haye');
    await press(lastAlert().buttons[0]);
    expect(names()).toEqual(['Boucle du Bois de la Côte', 'Haye']);
    expect(await listRoutes(db)).toHaveLength(2);
  });

  it('« Supprimer » retire la ligne aussitôt, et seulement celle-là', async () => {
    await ask('Haye');
    await press(lastAlert().buttons[1]);
    expect(names()).toEqual(['Boucle du Bois de la Côte']);
    expect((await listRoutes(db)).map((r) => r.name)).toEqual([
      'Boucle du Bois de la Côte',
    ]);
  });

  it("fermer la boîte sans choisir (retour d'Android) ne supprime rien", async () => {
    await ask('Haye');
    // Alert.alert d'Android : cancelable par défaut, le bouton « cancel » sert de retour.
    expect(lastAlert().buttons.some((b) => b.style === 'cancel')).toBe(true);
    expect(await listRoutes(db)).toHaveLength(2);
  });
});

describe('C8 : zone absente dans la liste (maquette 40, état 7a)', () => {
  it("remplace l'origine par le problème, garde les chiffres, ouvre toujours la ligne", async () => {
    await insertRoute(
      db,
      sampleGpx({
        name: 'Metz – Gorze',
        savedAt: 400,
        zone: null,
        ascentM: null,
        distanceKm: 18.2,
        durationS: 109 * 60,
      }),
    );
    await insertRoute(
      db,
      sampleCreated({
        name: 'Longemer',
        savedAt: 300,
        zone: { id: 'gerardmer', version: 1, name: 'Gérardmer' },
        distanceKm: 19.6,
        ascentM: 548,
        durationS: 100 * 60,
      }),
    );
    await insertRoute(
      db,
      sampleCreated({ name: 'Nancy', savedAt: 200, ascentM: 421 }),
    );
    await open();
    expect(screen.getByText('Hors de vos zones')).toBeTruthy();
    expect(screen.getByText('Zone Gérardmer supprimée')).toBeTruthy();
    expect(screen.queryByText(/Zone Gérardmer supprimée ·/)).toBeNull();
    // Seule la ligne Metz – Gorze n'a jamais eu de D+ : « — ».
    expect(screen.getAllByText(/D\+ —/)).toHaveLength(1);
    expect(
      flat(screen.getByTestId('route-row-2').props.accessibilityLabel),
    ).toContain('19,6 km, montée 548 m, 1 h 40');
    await fireEvent.press(screen.getByTestId('route-row-2'));
    expect(mockPush).toHaveBeenCalledWith('/route/2');
  });

  it('permet encore de renommer puis de supprimer', async () => {
    await insertRoute(
      db,
      sampleCreated({
        name: 'Longemer',
        zone: { id: 'gerardmer', version: 1, name: 'Gérardmer' },
      }),
    );
    await open();
    await fireEvent.press(screen.getByLabelText('Actions de Longemer'));
    expect(menuTexts()).toHaveLength(4);
    await press(menuEntry('rename'));
    await fireEvent.changeText(
      screen.getByLabelText("Nom de l'itinéraire"),
      'Lac',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Renommer' }));
    await settle();
    expect(screen.getByText('Lac')).toBeTruthy();
    expect(screen.getByText('Zone Gérardmer supprimée')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Actions de Lac'));
    await press(menuEntry('delete'));
    await press(lastAlert().buttons[1]);
    expect(await listRoutes(db)).toHaveLength(0);
    expect(screen.getByText("Pas encore d'itinéraire")).toBeTruthy();
  });

  it('une base trop récente : message, pas de plantage', async () => {
    mockDb = Promise.reject(new RoutesTooNewError());
    mockDb.catch(() => undefined);
    await open();
    expect(screen.getByText('Itinéraires indisponibles')).toBeTruthy();
    expect(
      screen.getByText(
        'Mettez à jour RutaPulse pour retrouver vos itinéraires.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Pas encore d'itinéraire")).toBeNull();
  });

  it('une base illisible (autre erreur) : message, pas de plantage', async () => {
    mockDb = Promise.reject(new Error('disque plein'));
    mockDb.catch(() => undefined);
    await open();
    expect(
      screen.getByText(
        'Vos itinéraires ne peuvent pas être lus pour le moment.',
      ),
    ).toBeTruthy();
  });
});

describe('C13 (indicatif, Jest) : 50 lignes', () => {
  it('rend 50 lignes et mesure le temps', async () => {
    const preview = encodePolyline6(
      Array.from({ length: 66 }, (_, k): [number, number] => [
        6.1 + k * 0.001,
        48.6 + Math.sin(k / 5) * 0.01,
      ]),
    );
    for (let i = 0; i < 50; i++) {
      await insertRoute(
        db,
        sampleCreated({ name: `Sortie ${i}`, savedAt: 1_000 + i, preview }),
      );
    }
    const start = performance.now();
    await open();
    const ms = performance.now() - start;
    console.log(
      `C13 indicatif : 50 lignes rendues en ${Math.round(ms)} ms (dont 40 ms d'attente fixe)`,
    );
    expect(screen.getAllByTestId(/^route-row-\d+$/)).toHaveLength(50);
    expect(names()[0]).toBe('Sortie 49');
    expect(ms).toBeLessThan(1000);
  });
});
