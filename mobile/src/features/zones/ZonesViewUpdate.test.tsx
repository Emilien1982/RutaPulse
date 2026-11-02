// Update part of the card of a ready zone: mockup 41, screens 2 to 4.
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RowUpdate, ZoneRow, ZoneRows } from '@/core/zones/zoneRow';
import { makeZone } from '@/core/zones/fakeZoneOps';

import { ZonesView, type ZonesViewProps } from './ZonesView';

const next = {
  ...makeZone({ 'a.bin': 'A' }, 'nancy', 4),
  name: 'Nancy et forêt de Haye',
  totalBytes: 108_000_000,
  osmDate: '2026-11-02T10:00:00Z',
};

const nancy = (update?: RowUpdate): ZoneRow => ({
  id: 'nancy',
  name: 'Nancy et forêt de Haye',
  totalBytes: 106_000_000,
  osmDate: '2026-10-18T10:00:00Z',
  status: { kind: 'ready' },
  ...(update ? { update } : {}),
});

function props(row: ZoneRow, overrides: Partial<ZonesViewProps> = {}) {
  const rows: ZoneRows = {
    installed: [row],
    available: [],
    installedBytes: 106_000_000,
    waitingForWifi: false,
  };
  return {
    rows,
    catalogue: 'ready',
    onReloadCatalogue: jest.fn(),
    freeBytes: null,
    wifiOnly: true,
    onWifiOnlyChange: jest.fn(),
    onDownload: jest.fn(),
    onCancel: jest.fn(),
    onRetry: jest.fn(),
    onMenu: jest.fn(),
    ...overrides,
  } satisfies ZonesViewProps;
}

describe('ZonesView, update available (screen 2)', () => {
  it('keeps the top of the card and adds the offer', async () => {
    await render(
      <ZonesView {...props(nancy({ kind: 'available', zone: next }))} />,
    );
    expect(screen.getByText('106 Mo · carte du 18 oct.')).toBeTruthy();
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();
    expect(screen.getByText('Mise à jour disponible')).toBeTruthy();
    expect(screen.getByText('108 Mo · carte du 2 nov.')).toBeTruthy();
    expect(screen.getByText('Mettre à jour')).toBeTruthy();
  });

  it('"Mettre à jour" asks for the zone by its id; there is no cross', async () => {
    const p = props(nancy({ kind: 'available', zone: next }));
    await render(<ZonesView {...p} />);
    fireEvent.press(
      screen.getByLabelText(
        'Mettre à jour la zone Nancy et forêt de Haye (108 Mo)',
      ),
    );
    expect(p.onDownload).toHaveBeenCalledWith('nancy');
    expect(screen.queryByLabelText(/Annuler la mise à jour/)).toBeNull();
  });

  it('same map date: the size alone, no date', async () => {
    const same = { ...next, osmDate: '2026-10-18T10:00:00Z' };
    await render(
      <ZonesView {...props(nancy({ kind: 'available', zone: same }))} />,
    );
    expect(screen.getByText('108 Mo')).toBeTruthy();
  });

  it('no part: the card is the one of screen 1', async () => {
    await render(<ZonesView {...props(nancy())} />);
    expect(screen.queryByText('Mise à jour disponible')).toBeNull();
    expect(screen.queryByText('Mettre à jour')).toBeNull();
  });
});

describe('ZonesView, update running (screens 3 and 4)', () => {
  const running = (status: Extract<RowUpdate, { kind: 'running' }>['status']) =>
    nancy({ kind: 'running', zone: next, status });

  it('downloading: title, bar, progress, note, cross', async () => {
    const p = props(
      running({
        kind: 'downloading',
        doneBytes: 47_000_000,
        totalBytes: 108_000_000,
      }),
    );
    await render(<ZonesView {...p} />);
    expect(screen.getByText('Mise à jour : carte du 2 nov.')).toBeTruthy();
    expect(screen.getByText('47 Mo sur 108')).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable pendant la mise à jour.'),
    ).toBeTruthy();
    expect(screen.getByText('Prête sans réseau')).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText('Annuler la mise à jour de Nancy et forêt de Haye'),
    );
    expect(p.onCancel).toHaveBeenCalledWith('nancy');
  });

  it('queued', async () => {
    await render(<ZonesView {...props(running({ kind: 'queued' }))} />);
    expect(screen.getByText('En attente de son tour')).toBeTruthy();
  });

  it('waiting for the Wi-Fi', async () => {
    await render(
      <ZonesView
        {...props(
          running({
            kind: 'waiting',
            reason: 'no-wifi',
            doneBytes: 0,
            totalBytes: 108_000_000,
          }),
        )}
      />,
    );
    expect(screen.getByText('En attente du Wi-Fi · 0 Mo sur 108')).toBeTruthy();
  });

  it('failed: red line, old map date, "Réessayer"', async () => {
    const p = props(
      running({
        kind: 'failed',
        doneBytes: 47_000_000,
        totalBytes: 108_000_000,
      }),
    );
    await render(<ZonesView {...p} />);
    expect(
      screen.getByText('Échec de la mise à jour · 47 Mo sur 108'),
    ).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable avec la carte du 18 oct.'),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText(
        'Réessayer la mise à jour de Nancy et forêt de Haye',
      ),
    );
    expect(p.onRetry).toHaveBeenCalledWith('nancy');
  });

  it('not enough room', async () => {
    const p = props(running({ kind: 'no-space', neededBytes: 158_000_000 }));
    await render(<ZonesView {...p} />);
    expect(
      screen.getByText('Place insuffisante : il faut 158 Mo libres.'),
    ).toBeTruthy();
    expect(
      screen.getByText('La zone reste utilisable avec la carte du 18 oct.'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Réessayer la mise à jour de Nancy et forêt de Haye',
      ),
    ).toBeTruthy();
  });

  it('same map date: the title has no date', async () => {
    const same = { ...next, osmDate: '2026-10-18T10:00:00Z' };
    await render(
      <ZonesView
        {...props(
          nancy({ kind: 'running', zone: same, status: { kind: 'queued' } }),
        )}
      />,
    );
    expect(screen.getByText('Mise à jour')).toBeTruthy();
  });
});
