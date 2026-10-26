import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RowStatus, ZoneRow, ZoneRows } from '@/core/zones/zoneRow';

import { ZonesView, type ZonesViewProps } from './ZonesView';

const row = (id: string, name: string, status: RowStatus): ZoneRow => ({
  id,
  name,
  totalBytes: 95_000_000,
  osmDate: '2026-10-18T10:00:00Z',
  status,
});

function rowsOf(
  available: ZoneRow[],
  installed: ZoneRow[] = [],
  waitingForWifi = false,
): ZoneRows {
  return {
    available,
    installed,
    installedBytes: installed.length * 106_000_000,
    waitingForWifi,
  };
}

function props(overrides: Partial<ZonesViewProps> = {}): ZonesViewProps {
  return {
    rows: rowsOf([]),
    catalogue: 'ready',
    onReloadCatalogue: jest.fn(),
    freeBytes: 23_400_000_000,
    wifiOnly: true,
    onWifiOnlyChange: jest.fn(),
    onDownload: jest.fn(),
    onCancel: jest.fn(),
    onRetry: jest.fn(),
    onMenu: jest.fn(),
    ...overrides,
  };
}

describe('ZonesView, list', () => {
  it('shows the title, name, size and date of each zone', async () => {
    await render(
      <ZonesView
        {...props({
          rows: rowsOf([row('metz', 'Metz', { kind: 'available' })]),
        })}
      />,
    );
    expect(screen.getByText('Zones hors ligne')).toBeTruthy();
    expect(screen.getByText('Metz')).toBeTruthy();
    expect(screen.getByText('95 Mo · carte du 18 oct.')).toBeTruthy();
    expect(screen.getByText('Disponibles')).toBeTruthy();
    expect(screen.getByText('23,4 Go libres')).toBeTruthy();
  });

  it('explains what a zone is, under the list (mockup 41)', async () => {
    await render(<ZonesView {...props()} />);
    expect(
      screen.getByText(
        "Une zone contient la carte, le calcul d'itinéraire et l'altitude d'un carré d'environ 50 km de côté. Une fois téléchargée, tout marche sans réseau : carte, création et suivi.",
      ),
    ).toBeTruthy();
  });

  it('shows no banner when nothing waits for the Wi-Fi', async () => {
    await render(<ZonesView {...props()} />);
    expect(screen.queryByText('Pas de Wi-Fi :')).toBeNull();
  });
});

describe('ZonesView, states', () => {
  it('available: a "Télécharger" button that asks for the zone', async () => {
    const p = props({
      rows: rowsOf([row('metz', 'Metz', { kind: 'available' })]),
    });
    await render(<ZonesView {...p} />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Télécharger la zone Metz (95 Mo)' }),
    );
    expect(p.onDownload).toHaveBeenCalledWith('metz');
  });

  it('downloading: a progress bar, the megabytes, and a cross', async () => {
    const p = props({
      rows: rowsOf([
        row('metz', 'Metz', {
          kind: 'downloading',
          doneBytes: 40_000_000,
          totalBytes: 95_000_000,
        }),
      ]),
    });
    await render(<ZonesView {...p} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
    expect(screen.getByText('40 Mo sur 95')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Télécharger/ })).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Annuler le téléchargement de Metz' }),
    );
    expect(p.onCancel).toHaveBeenCalledWith('metz');
  });

  it('queued: says that the zone waits its turn, with a cross', async () => {
    await render(
      <ZonesView
        {...props({ rows: rowsOf([row('metz', 'Metz', { kind: 'queued' })]) })}
      />,
    );
    expect(screen.getByText('En attente de son tour')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeTruthy();
  });

  it('waiting for the Wi-Fi: banner with the switch, row text, and the switch works', async () => {
    const p = props({
      rows: rowsOf(
        [
          row('metz', 'Metz', {
            kind: 'waiting',
            reason: 'no-wifi',
            doneBytes: 40_000_000,
            totalBytes: 95_000_000,
          }),
        ],
        [],
        true,
      ),
    });
    await render(<ZonesView {...p} />);
    expect(screen.getByText('Pas de Wi-Fi :')).toBeTruthy();
    expect(screen.getByText('En attente du Wi-Fi · 40 Mo sur 95')).toBeTruthy();
    const toggle = screen.getByRole('switch', {
      name: 'Télécharger en Wi-Fi seulement',
    });
    expect(toggle.props.accessibilityState).toEqual({ checked: true });

    await fireEvent.press(toggle);
    expect(p.onWifiOnlyChange).toHaveBeenCalledWith(false);
  });

  it('waiting for the network: row text without the banner', async () => {
    await render(
      <ZonesView
        {...props({
          rows: rowsOf([
            row('metz', 'Metz', {
              kind: 'waiting',
              reason: 'no-network',
              doneBytes: 0,
              totalBytes: 95_000_000,
            }),
          ]),
        })}
      />,
    );
    expect(screen.getByText('En attente du réseau · 0 Mo sur 95')).toBeTruthy();
    expect(screen.queryByText('Pas de Wi-Fi :')).toBeNull();
  });

  it('failed: the failure and a "Réessayer" button', async () => {
    const p = props({
      rows: rowsOf([
        row('metz', 'Metz', {
          kind: 'failed',
          doneBytes: 40_000_000,
          totalBytes: 95_000_000,
        }),
      ]),
    });
    await render(<ZonesView {...p} />);
    expect(
      screen.getByText('Échec du téléchargement · 40 Mo sur 95'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Réessayer/ }));
    expect(p.onRetry).toHaveBeenCalledWith('metz');
  });

  it('no space: says how much is needed, with "Réessayer"', async () => {
    const p = props({
      rows: rowsOf([
        row('metz', 'Metz', { kind: 'no-space', neededBytes: 145_000_000 }),
      ]),
    });
    await render(<ZonesView {...p} />);
    expect(
      screen.getByText('Place insuffisante : il faut 145 Mo libres.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Réessayer/ }));
    expect(p.onRetry).toHaveBeenCalledWith('metz');
  });

  it('ready: "Prête sans réseau", the total on the phone, and the menu', async () => {
    const p = props({
      rows: rowsOf([], [row('nancy', 'Nancy', { kind: 'ready' })]),
    });
    await render(<ZonesView {...p} />);
    expect(screen.getByText('Sur le téléphone')).toBeTruthy();
    expect(screen.getByText('106 Mo')).toBeTruthy();
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Actions de la zone Nancy : supprimer',
      }),
    );
    expect(p.onMenu).toHaveBeenCalledWith('nancy');
  });
});

describe('ZonesView, catalogue', () => {
  it('unreachable: an error and a button to try again', async () => {
    const p = props({ catalogue: 'error' });
    await render(<ZonesView {...p} />);
    expect(
      screen.getByText('Le catalogue des zones est injoignable.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(p.onReloadCatalogue).toHaveBeenCalled();
  });

  it('unreachable: installed zones are still listed', async () => {
    await render(
      <ZonesView
        {...props({
          catalogue: 'error',
          rows: rowsOf([], [row('nancy', 'Nancy', { kind: 'ready' })]),
        })}
      />,
    );
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();
  });

  it('loading: says so', async () => {
    await render(<ZonesView {...props({ catalogue: 'loading' })} />);
    expect(screen.getByText('Lecture du catalogue…')).toBeTruthy();
  });
});
