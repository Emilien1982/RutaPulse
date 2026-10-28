// Guard of the abort signal in the engine queue (ADR 0016, section 4).
import type { Zone } from '../zones/catalogue';
import { createRoutingEngine, type NativeRouting } from './routingEngine';

const SUCCESS = JSON.stringify({
  trip: {
    summary: { length: 5.9, time: 1200 },
    legs: [{ shape: '_l`y{Aw~ksJoul@gwkA' }],
  },
});
const zone: Zone = {
  id: 'z',
  name: 'z',
  version: 1,
  bbox: { lonMin: 5.9, latMin: 48.5, lonMax: 6.4, latMax: 48.9 },
  osmDate: '2026-01-01T00:00:00Z',
  totalBytes: 1,
  files: [],
};
const A = { lon: 6.0, lat: 48.6 };
const B = { lon: 6.1, lat: 48.7 };

it('skips a call aborted before its turn: no native call, failed', async () => {
  let release!: (text: string) => void;
  const route = jest
    .fn<Promise<string>, [string]>()
    .mockImplementationOnce(
      () => new Promise<string>((resolve) => (release = resolve)),
    )
    .mockResolvedValue(SUCCESS);
  const native: NativeRouting = {
    open: async () => undefined,
    close: async () => undefined,
    route,
  };
  const engine = createRoutingEngine(native, () => ({
    tarPath: '/t',
    elevationDir: '/e',
  }));
  engine.setZone(zone);
  const first = engine.route([A, B]);
  const controller = new AbortController();
  const second = engine.route([A, B], controller.signal);
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 0));
  release(SUCCESS);
  expect((await first).ok).toBe(true);
  expect(await second).toEqual({ ok: false, error: 'failed' });
  expect(route).toHaveBeenCalledTimes(1);
});
