// C11, the engine: the promise of setZone is kept only after the old zone is
// closed and the new one opened; calls already queued end on the old zone, calls
// made afterwards run on the new one (ADR 0018, section 4, ADR 0015).
import type { Zone } from '../zones/catalogue';
import { createRoutingEngine, type NativeRouting } from './routingEngine';

const zone = (version: number): Zone => ({
  id: 'nancy',
  name: 'Nancy',
  version,
  bbox: { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 },
  osmDate: '2026-11-01T21:21:36Z',
  totalBytes: 1,
  files: [],
});
const A = { lon: 6.0, lat: 48.6 };
const B = { lon: 6.1, lat: 48.7 };

it('setZone promise kept after the reopening; queued call on v3, later call on v4', async () => {
  const log: string[] = [];
  let open = '';
  let releaseOpen = () => {};
  const native: NativeRouting = {
    open: async (tar) => {
      log.push(`open ${tar}`);
      if (tar === '/v4.tar') {
        await new Promise<void>((r) => (releaseOpen = r));
      }
      open = tar;
    },
    close: async () => {
      log.push('close');
      open = '';
    },
    route: async () => {
      log.push(`route on ${open}`);
      return JSON.stringify({
        trip: { summary: { length: 1, time: 1 }, legs: [{ shape: '??' }] },
      });
    },
  };
  const engine = createRoutingEngine(native, (z) => ({
    tarPath: `/v${z.version}.tar`,
    elevationDir: '/e',
  }));
  await engine.setZone(zone(3));
  const queued = engine.route([A, B]);
  let kept = false;
  const switched = engine.setZone(zone(4)).then(() => (kept = true));
  const later = engine.route([A, B]);

  await queued;
  await new Promise((r) => setTimeout(r, 20));
  expect(kept).toBe(false); // v4 is still opening
  releaseOpen();
  await switched;
  expect(kept).toBe(true);
  await later;
  expect(log).toEqual([
    'open /v3.tar',
    'route on /v3.tar',
    'close',
    'open /v4.tar',
    'route on /v4.tar',
  ]);
});
