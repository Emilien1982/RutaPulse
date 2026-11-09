// Corrections of the T8 comparison to the list (mockup 40): title under the
// import button on iOS (B1), no sun on the empty list (M3), sand medallion
// (M4), file icon (M5), import button redrawn on Android (M10).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { encodePolyline6 } from '@/core/routing/routeResponse';
import { MIGRATIONS, migrate } from '@/core/routes/migrations';
import { insertRoute } from '@/core/routes/routeRepo';
import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';
import { sampleCreated } from '@/core/routes/testing/sampleRoutes';
import { colors } from '@/ui/theme';

import { RoutesScreen } from './RoutesScreen';

let mockTop = 0;
let mockDb: Promise<unknown>;
let mockBusy = false;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: () => Promise.resolve({ canceled: true, assets: null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: mockTop, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared-data/routes/routesDb', () => ({
  getRoutesDb: () => mockDb,
}));
jest.mock('@/shared-data/zones/zoneInService', () => ({
  useZoneInService: () => ({ id: 'nancy' }),
}));
jest.mock('@/shared-data/zones/useInstalledZones', () => ({
  useInstalledZones: () => ({
    data: [{ zone: { id: 'nancy' }, installedAt: '2026-11-01' }],
  }),
}));
jest.mock('./useGpxImport', () => ({
  useGpxImport: () => ({ start: jest.fn(), busy: mockBusy, sheet: null }),
}));

let db: NodeSqlDb;
let client: QueryClient;

async function open() {
  client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <RoutesScreen />
    </QueryClientProvider>,
  );
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

beforeEach(async () => {
  mockTop = 0;
  mockBusy = false;
  db = createNodeSqlDb();
  await migrate(db, MIGRATIONS);
  mockDb = Promise.resolve(db);
});
afterEach(() => {
  client.clear();
  db.close();
});

describe('B1: the title stays under the import button', () => {
  const titleTop = () => flat(screen.getByText('Mes itinéraires')).top;

  it('keeps 101 when the safe area is small (Android, old iPhones)', async () => {
    mockTop = 24;
    await open();
    expect(titleTop()).toBe(101);
  });

  it('goes down to inset + 66 on an iPhone with a notch (62)', async () => {
    mockTop = 62;
    await open();
    expect(titleTop()).toBe(128);
    // The button: 7 under the safe area, 48 tall, 11 above the title.
    expect(flat(screen.getByTestId('routes-import')).top).toBe(69);
  });
});

describe('the other tabs keep their title at 101', () => {
  it('ScreenFrame without titleTop', async () => {
    const { ScreenFrame } = jest.requireActual('@/ui/ScreenFrame');
    await render(<ScreenFrame title="Zones">{null}</ScreenFrame>);
    expect(flat(screen.getByText('Zones')).top).toBe(101);
  });
});

// The rendered tree as text: icons and styles can be looked for in it.
const tree = (node: unknown) => JSON.stringify(node);

describe('M5, M10: the import button', () => {
  it('draws the sheet with a folded corner, not a plus', async () => {
    // A filled list: the empty one has its own "+" on "Créer un itinéraire".
    await insertRoute(db, sampleCreated({ name: 'Boucle' }));
    await open();
    const json = tree(screen.toJSON());
    expect(json).toContain('M14 3H6v18h12V7z');
    expect(json).toContain('M14 3v4h4');
    expect(json).not.toContain('M12 5v14M5 12h14');
  });

  it('is enabled and says "Importer un GPX" when idle (the key swap is for Android: see the simulator)', async () => {
    await open();
    expect(
      screen.getByTestId('routes-import').props.accessibilityState,
    ).toEqual({ disabled: false });
    expect(screen.getByText('Importer un GPX')).toBeTruthy();
  });
});

describe('M3: the empty list has no sun', () => {
  it('draws the cyclist scene alone', async () => {
    await open();
    expect(screen.getByTestId('routes-empty')).toBeTruthy();
    // The sun was a mustard circle of radius 90.
    expect(tree(screen.toJSON())).not.toMatch(/"r":"?90"?/);
  });
});

describe('M4: the medallion is on sand', () => {
  it('draws the preview on the sand color', async () => {
    await insertRoute(
      db,
      sampleCreated({
        name: 'Boucle',
        preview: encodePolyline6([
          [6.1, 48.66],
          [6.14, 48.68],
        ]),
      }),
    );
    await open();
    expect(tree(screen.toJSON())).toContain(colors.sand);
  });
});
