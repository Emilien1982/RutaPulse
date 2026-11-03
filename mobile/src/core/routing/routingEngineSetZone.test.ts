// `setZone` returns a promise (ADR 0018, section 4).
import type { Zone } from '../zones/catalogue';
import { createRoutingEngine, type NativeRouting } from './routingEngine';

const SUCCESS = JSON.stringify({
  trip: {
    summary: { length: 5.9, time: 1200 },
    legs: [{ shape: '_l`y{Aw~ksJoul@gwkA' }],
  },
});
const makeZone = (version: number): Zone => ({
  id: 'z',
  name: 'z',
  version,
  bbox: { lonMin: 5.9, latMin: 48.5, lonMax: 6.4, latMax: 48.9 },
  osmDate: '2026-01-01T00:00:00Z',
  totalBytes: 1,
  files: [],
});
const v3 = makeZone(3);
const v4 = makeZone(4);
const A = { lon: 6.0, lat: 48.6 };
const B = { lon: 6.1, lat: 48.7 };

function setup(open: NativeRouting['open'] = async () => undefined) {
  const events: string[] = [];
  const native: NativeRouting = {
    open: async (tar, elevation) => {
      events.push(`open ${tar}`);
      await open(tar, elevation);
    },
    close: async () => {
      events.push('close');
    },
    route: async () => {
      events.push('route');
      return SUCCESS;
    },
  };
  const engine = createRoutingEngine(native, (zone) => ({
    tarPath: `/v${zone.version}.tar`,
    elevationDir: '/e',
  }));
  return { engine, events };
}

describe('setZone promise', () => {
  it('is kept once the old zone is closed and the new one open', async () => {
    const { engine, events } = setup();
    await engine.setZone(v3);
    expect(events).toEqual(['open /v3.tar']);

    await engine.setZone(v4);
    expect(events).toEqual(['open /v3.tar', 'close', 'open /v4.tar']);
    expect(engine.getState()).toBe('open');
  });

  it('is kept, not rejected, when the opening fails', async () => {
    const { engine } = setup(async () => {
      throw new Error('boom');
    });
    await expect(engine.setZone(v3)).resolves.toBeUndefined();
    expect(engine.getState()).toBe('failed');
  });

  it('is kept for the same zone asked twice', async () => {
    const { engine, events } = setup();
    await engine.setZone(v3);
    await engine.setZone(v3);
    expect(events).toEqual(['open /v3.tar']);
  });

  it('a call asked after setZone(v4) runs on v4; one already queued ends on v3', async () => {
    const { engine, events } = setup();
    await engine.setZone(v3);
    const before = engine.route([A, B]);
    const switched = engine.setZone(v4);
    const after = engine.route([A, B]);

    expect((await before).ok).toBe(true);
    expect((await after).ok).toBe(true);
    await switched;
    expect(events).toEqual([
      'open /v3.tar',
      'route',
      'close',
      'open /v4.tar',
      'route',
    ]);
  });
});
